import type { AuthContext } from '../_middleware';
import { getUserIdByEmail as getUserIdByEmailRepo } from '../repositories/userRepository';
import { initializeDefaultCategories } from '../repositories/categoryRepository';
import { getSyncEventByMutationId, getMaxSyncEventId, getPullEvents } from '../repositories/syncEventRepository';
import { postCategory, putCategory, deleteCategory } from '../services/categoryService';
import { postTransaction, putTransaction, deleteTransaction } from '../services/transactionService';
import { postUserShare, putUserShare, deleteUserShare } from '../services/userShareService';

interface Env {
	DB: D1Database;
}

interface User {
	id: string;
	email: string;
	created_at: string;
	updated_at: string;
}

type EntityType = "CAT" | "TXN" | "SHR";

type ActionType = "PUT" | "DELETE" | "POST";

interface SyncRequest {
	last_cursor: number;
	push_commands?: PushCommand[];
	user?: { id: string; email: string } | null;
}

interface PushCommand {
	mutation_id: string;
	entity_type: EntityType;
	entity_id: string;
	action: ActionType;
	base_version: number;
	payload?: unknown;
}

interface PushResult {
	mutation_id: string;
	status: 'OK' | 'ERROR' | 'SKIPPED';
	version?: number | null;
	error_code?: string | null;
	error_message?: string | null;
}

interface PullEvent {
	id: number;
	mutation_id: string;
	entity_type: EntityType;
	entity_id: string;
	action: ActionType;
	version: number;
	payload?: string | null;
}

async function getUserIdByEmail(email: string, DB: D1Database): Promise<string> {
	const userId = await getUserIdByEmailRepo(email, DB);
	
	// Check if this is a new user (just created)
	const existing = await DB.prepare('SELECT created_at FROM users WHERE id = ?')
		.bind(userId)
		.first<{ created_at: string }>();
	
	if (existing) {
		const createdAt = new Date(existing.created_at);
		const now = new Date();
		const diffSeconds = (now.getTime() - createdAt.getTime()) / 1000;
		
		// If user was just created (within 1 second), initialize default categories
		if (diffSeconds < 1) {
			await initializeDefaultCategories(userId, DB);
		}
	}
	
	return userId;
}

// Entity handlers map
type EntityHandler = (event: PushCommand, context: ServiceContext) => Promise<PushResult>;
interface ServiceContext {
	userId: string;
	userEmail: string;
	DB: D1Database;
}

const entityHandlers: Record<string, EntityHandler> = {
	"POST:CAT": postCategory,
	"PUT:CAT": putCategory,
	"DELETE:CAT": deleteCategory,
	"POST:TXN": postTransaction,
	"PUT:TXN": putTransaction,
	"DELETE:TXN": deleteTransaction,
	"POST:SHR": postUserShare,
	"PUT:SHR": putUserShare,
	"DELETE:SHR": deleteUserShare,
}

export const onRequest: PagesFunction<Env, any, AuthContext> = async (context) => {
	const { DB } = context.env;
	const userEmail = context.data.email;
	const userId = await getUserIdByEmail(userEmail, DB);
	
	if (context.request.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405 });
	}

	let body: SyncRequest;
	try {
		body = (await context.request.json()) as SyncRequest;
	} catch {
		return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
	}

	if (!isNumber(body?.last_cursor)) {
		return jsonResponse({ error: "last_cursor must be a number" }, { status: 400 });
	}

	// Validate user field if provided
	if (body.user !== undefined && body.user !== null) {
		if (body.user.email !== userEmail) {
			return jsonResponse({ error: "User email mismatch" }, { status: 403 });
		}
		if (body.user.id !== userId) {
			return jsonResponse({ error: "User id mismatch" }, { status: 403 });
		}
	}

	const pushCommands = Array.isArray(body.push_commands) ? body.push_commands : [];
	const pushResults: PushResult[] = [];

	try {
		for (const event of sortPushCommands(pushCommands)) {
			if (
				!isNonEmptyString(event?.mutation_id) ||
				!isNonEmptyString(event?.entity_id) ||
				!isNonEmptyString(event?.entity_type) ||
				!isNonEmptyString(event?.action) ||
				!isNumber(event?.base_version)
			) {
				return jsonResponse({ error: "Invalid push_commands entry" }, { status: 400 });
			}

			if (!isValidEntityType(event.entity_type)) {
				return jsonResponse(
					{ error: `Unsupported entity_type: ${event.entity_type}` },
					{ status: 400 }
				);
			}

			if (!isValidAction(event.action)) {
				return jsonResponse({ error: `Unsupported action: ${event.action}` }, { status: 400 });
			}

			const existingMutation = await getSyncEventByMutationId(event.mutation_id, DB);

			if (existingMutation) {
				pushResults.push({ mutation_id: event.mutation_id, status: 'SKIPPED' });
				continue;
			}

			// Use entity handler from map
			const handlerKey = `${event.action}:${event.entity_type}` as const;
			const handler = entityHandlers[handlerKey];

			if (!handler) {
				return jsonResponse(
					{ error: `Unsupported action-entity combination: ${handlerKey}` },
					{ status: 400 }
				);
			}

			const serviceContext: ServiceContext = { userId, userEmail, DB };
			const result = await handler(event, serviceContext);

			pushResults.push(result);
		}
	} catch (error: any) {
		return jsonResponse({ error: error?.message ?? "Sync failed" }, { status: 500 });
	}

	const processedMutationIds = pushResults.map(r => r.mutation_id);
	const maxCursor = await getMaxSyncEventId(userId, DB);
	const newCursor = maxCursor > 0 ? maxCursor : body.last_cursor;

	const pullQueryResults = await getPullEvents(userId, body.last_cursor, processedMutationIds, DB);
	const pullEvents: PullEvent[] = pullQueryResults.map((row: any) => {
		let action: ActionType = "PUT";
		let version = 0;
		let payload: string | null = row.payload ?? null;

		if (row.payload) {
			try {
				const parsed = JSON.parse(row.payload);
				if (parsed?.action === "PUT" || parsed?.action === "DELETE") {
					action = parsed.action;
				}
				if (isNumber(parsed?.version)) {
					version = parsed.version;
				}
				if (parsed?.payload !== undefined) {
					payload = parsed.payload ?? null;
				}
			} catch {
				// Keep raw payload if not JSON
			}
		}

		return {
			id: row.id as number,
			mutation_id: row.mutation_id as string,
			entity_type: row.entity_type,
			entity_id: row.entity_id as string,
			action,
			version,
			payload,
		};
	});

	return jsonResponse({
		new_cursor: newCursor,
		push_results: pushResults,
		pull_events: pullEvents,
		user: { id: userId, email: userEmail },
	});
};

function jsonResponse(body: unknown, init?: ResponseInit): Response {
	return new Response(JSON.stringify(body), {
		...init,
		headers: {
			"Content-Type": "application/json",
			...(init?.headers ?? {}),
		},
	});
}

function parsePayload(payload: unknown): { payloadString: string | null; payloadObject: any } {
	if (payload === undefined || payload === null) {
		return { payloadString: null, payloadObject: null };
	}
	if (typeof payload === "string") {
		try {
			const parsed = JSON.parse(payload);
			return { payloadString: payload, payloadObject: parsed };
		} catch {
			return { payloadString: payload, payloadObject: payload };
		}
	}
	return { payloadString: JSON.stringify(payload), payloadObject: payload };
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function isNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function sortPushCommands(commands: PushCommand[]): PushCommand[] {
	const priority: Record<EntityType, number> = { CAT: 0, TXN: 1, SHR: 2 };
	return [...commands].sort((a, b) => priority[a.entity_type] - priority[b.entity_type]);
}

function isValidEntityType(value: unknown): value is EntityType {
	return value === "CAT" || value === "TXN" || value === "SHR";
}

function isValidAction(value: unknown): value is ActionType {
	return value === "PUT" || value === "DELETE" || value === "POST";
}
