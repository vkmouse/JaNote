import type { AuthContext } from '../_middleware';

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

type EntryType = "EXPENSE" | "INCOME";

interface SyncRequest {
	last_cursor: number;
	push_events?: PushEvent[];
	user?: { id: string; email: string } | null;
}

interface PushEvent {
	mutation_id: string;
	entity_type: EntityType;
	entity_id: string;
	action: ActionType;
	base_version: number;
	payload?: unknown;
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
	// Try to get existing user
	const existing = await DB.prepare(
		'SELECT id FROM users WHERE email = ?'
	)
		.bind(email)
		.first<{ id: string }>();
	
	if (existing) {
		return existing.id;
	}
	
	// Create new user if doesn't exist
	const userId = crypto.randomUUID();
	const now = new Date().toISOString();
	
	await DB.prepare(
		'INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)'
	)
		.bind(userId, email, now, now)
		.run();
	
	// Initialize default categories for new user
	await initializeDefaultCategories(userId, DB);
	
	return userId;
}

async function initializeDefaultCategories(userId: string, DB: D1Database): Promise<void> {
	const expenseCategories = [
		'早餐', '午餐', '晚餐',   '飲品', '點心', '交通',
		'購物', '娛樂', '日用品', '房租', '醫療', '社交',
		'禮物', '數位', '其他',   '貓咪', '旅行'
	];
	const incomeCategories = [
		'薪水', '獎金', '利息', '股息', '投資', '其他'
	];

	// Create expense categories
	for (const name of expenseCategories) {
		const id = crypto.randomUUID();
		await DB.prepare(
			`INSERT INTO categories (id, user_id, name, type, version, is_deleted) VALUES (?, ?, ?, ?, ?, 0)`
		)
			.bind(id, userId, name, 'EXPENSE', 1)
			.run();

		const payload = JSON.stringify({
			action: 'PUT',
			version: 1,
			payload: JSON.stringify({
				id,
				name,
				type: 'EXPENSE',
			}),
		});

		await DB.prepare(
			`INSERT INTO sync_events (user_id, mutation_id, entity_type, entity_id, payload) VALUES (?, ?, ?, ?, ?)`
		)
			.bind(userId, crypto.randomUUID(), 'CAT', id, payload)
			.run();
	}

	// Create income categories
	for (const name of incomeCategories) {
		const id = crypto.randomUUID();
		await DB.prepare(
			`INSERT INTO categories (id, user_id, name, type, version, is_deleted) VALUES (?, ?, ?, ?, ?, 0)`
		)
			.bind(id, userId, name, 'INCOME', 1)
			.run();

		const payload = JSON.stringify({
			action: 'PUT',
			version: 1,
			payload: JSON.stringify({
				id,
				name,
				type: 'INCOME',
			}),
		});

		await DB.prepare(
			`INSERT INTO sync_events (user_id, mutation_id, entity_type, entity_id, payload) VALUES (?, ?, ?, ?, ?)`
		)
            .bind(userId, crypto.randomUUID(), 'CAT', id, payload)
			.run();
	}
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

	const pushEvents = Array.isArray(body.push_events) ? body.push_events : [];
	const processedMutationIds: string[] = [];

	try {
		for (const event of sortPushEvents(pushEvents)) {
			if (
				!isNonEmptyString(event?.mutation_id) ||
				!isNonEmptyString(event?.entity_id) ||
				!isNonEmptyString(event?.entity_type) ||
				!isNonEmptyString(event?.action) ||
				!isNumber(event?.base_version)
			) {
				return jsonResponse({ error: "Invalid push_events entry" }, { status: 400 });
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

			const existingMutation = await DB.prepare("SELECT id FROM sync_events WHERE mutation_id = ?")
				.bind(event.mutation_id)
				.first<{ id: number }>();

			if (existingMutation) {
				processedMutationIds.push(event.mutation_id);
				continue;
			}

			let errorResponse: Response | null = null;
			if (event.entity_type === "CAT") {
				errorResponse = await processCategoryEvent(event, userId, DB);
			} else if (event.entity_type === "TXN") {
				errorResponse = await processTransactionEvent(event, userId, DB);
			} else if (event.entity_type === "SHR") {
				errorResponse = await processUserShareEvent(event, userId, userEmail, DB);
			}

			if (errorResponse) {
				return errorResponse;
			}

			processedMutationIds.push(event.mutation_id);
		}
	} catch (error: any) {
		return jsonResponse({ error: error?.message ?? "Sync failed" }, { status: 500 });
	}

	const maxCursorRow = await DB.prepare("SELECT MAX(id) as max_id FROM sync_events WHERE user_id = ?")
		.bind(userId)
		.first<{ max_id: number | null }>();
	const newCursor = maxCursorRow?.max_id ?? body.last_cursor;

	let pullQuery =
		"SELECT id, mutation_id, entity_type, entity_id, payload FROM sync_events WHERE user_id = ? AND id > ?";
	const pullBinds: unknown[] = [userId, body.last_cursor];

	if (processedMutationIds.length > 0) {
		const placeholders = processedMutationIds.map(() => "?").join(", ");
		pullQuery += ` AND mutation_id NOT IN (${placeholders})`;
		pullBinds.push(...processedMutationIds);
	}
	pullQuery += " ORDER BY id ASC";

	const pullResults = await DB.prepare(pullQuery).bind(...pullBinds).all();
	const pullEvents: PullEvent[] = (pullResults.results || []).map((row: any) => {
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
		processed_mutation_ids: processedMutationIds,
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

function sortPushEvents(events: PushEvent[]): PushEvent[] {
	const priority: Record<EntityType, number> = { CAT: 0, TXN: 1, SHR: 2 };
	return [...events].sort((a, b) => priority[a.entity_type] - priority[b.entity_type]);
}

function isValidEntityType(value: unknown): value is EntityType {
	return value === "CAT" || value === "TXN" || value === "SHR";
}

function isValidAction(value: unknown): value is ActionType {
	return value === "PUT" || value === "DELETE" || value === "POST";
}

function isValidEntryType(value: unknown): value is EntryType {
	return value === "EXPENSE" || value === "INCOME";
}

async function processCategoryEvent(event: PushEvent, userId: string, DB: D1Database): Promise<Response | null> {
	const currentVersion = await getCategoryVersion(event.entity_id, userId, DB);
	const categoryExists = currentVersion > 0;

	if (event.base_version < currentVersion) {
		return null;
	}

	const { payloadString, payloadObject } = parsePayload(event.payload);

	if (event.action === "PUT") {
		const name = payloadObject?.name;
		const type = payloadObject?.type;

		if (!isNonEmptyString(name)) {
			return jsonResponse({ error: "Category name is required" }, { status: 400 });
		}

		if (!isValidEntryType(type)) {
			return jsonResponse({ error: "Category type is required" }, { status: 400 });
		}

		const newVersion = currentVersion + 1;
		if (categoryExists) {
			await DB.prepare(
				"UPDATE categories SET name = ?, type = ?, version = ?, is_deleted = 0 WHERE id = ? AND user_id = ?"
			)
				.bind(name, type, newVersion, event.entity_id, userId)
				.run();
		} else {
			await DB.prepare(
				"INSERT INTO categories (id, user_id, name, type, version, is_deleted) VALUES (?, ?, ?, ?, ?, 0)"
			)
				.bind(event.entity_id, userId, name, type, newVersion)
				.run();
		}

		const syncPayload = JSON.stringify({ action: event.action, version: newVersion, payload: payloadString });
		await DB.prepare(
			"INSERT INTO sync_events (user_id, mutation_id, entity_type, entity_id, payload) VALUES (?, ?, ?, ?, ?)"
		)
			.bind(userId, event.mutation_id, event.entity_type, event.entity_id, syncPayload)
			.run();

		return null;
	}

	if (!categoryExists) {
		return null;
	}

	const newVersion = currentVersion + 1;
	await DB.prepare("UPDATE categories SET version = ?, is_deleted = 1 WHERE id = ? AND user_id = ?")
		.bind(newVersion, event.entity_id, userId)
		.run();

	const syncPayload = JSON.stringify({ action: event.action, version: newVersion, payload: null });
	await DB.prepare(
		"INSERT INTO sync_events (user_id, mutation_id, entity_type, entity_id, payload) VALUES (?, ?, ?, ?, ?)"
	)
		.bind(userId, event.mutation_id, event.entity_type, event.entity_id, syncPayload)
		.run();

	return null;
}

async function processTransactionEvent(
	event: PushEvent,
	userId: string,
	DB: D1Database
): Promise<Response | null> {
	const currentVersion = await getTransactionVersion(event.entity_id, userId, DB);
	const transactionExists = currentVersion > 0;

	if (event.base_version < currentVersion) {
		return null;
	}

	const { payloadString, payloadObject } = parsePayload(event.payload);

	if (event.action === "PUT") {
		const categoryId = payloadObject?.category_id;
		const type = payloadObject?.type;
		const amount = payloadObject?.amount;
		const date = payloadObject?.date;
		const note = payloadObject?.note ?? null;

		if (!isNonEmptyString(categoryId) || !isValidEntryType(type) || !isNumber(amount) || !isNumber(date)) {
			return jsonResponse(
				{ error: "Transaction requires category_id, type, amount, and date" },
				{ status: 400 }
			);
		}

		const newVersion = currentVersion + 1;
		if (transactionExists) {
			await DB.prepare(
				"UPDATE transactions SET category_id = ?, type = ?, amount = ?, note = ?, date = ?, version = ?, is_deleted = 0 WHERE id = ? AND user_id = ?"
			)
				.bind(categoryId, type, amount, note, date, newVersion, event.entity_id, userId)
				.run();
		} else {
			await DB.prepare(
				"INSERT INTO transactions (id, user_id, category_id, type, amount, note, date, version, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)"
			)
				.bind(event.entity_id, userId, categoryId, type, amount, note, date, newVersion)
				.run();
		}

		const syncPayload = JSON.stringify({ action: event.action, version: newVersion, payload: payloadString });
		await DB.prepare(
			"INSERT INTO sync_events (user_id, mutation_id, entity_type, entity_id, payload) VALUES (?, ?, ?, ?, ?)"
		)
			.bind(userId, event.mutation_id, event.entity_type, event.entity_id, syncPayload)
			.run();

		return null;
	}

	if (!transactionExists) {
		return null;
	}

	const newVersion = currentVersion + 1;
	await DB.prepare("UPDATE transactions SET version = ?, is_deleted = 1 WHERE id = ? AND user_id = ?")
		.bind(newVersion, event.entity_id, userId)
		.run();

	const syncPayload = JSON.stringify({ action: event.action, version: newVersion, payload: null });
	await DB.prepare(
		"INSERT INTO sync_events (user_id, mutation_id, entity_type, entity_id, payload) VALUES (?, ?, ?, ?, ?)"
	)
		.bind(userId, event.mutation_id, event.entity_type, event.entity_id, syncPayload)
		.run();

	return null;
}

async function getCategoryVersion(id: string, userId: string, DB: D1Database): Promise<number> {
	const row = await DB.prepare("SELECT version FROM categories WHERE id = ? AND user_id = ?")
		.bind(id, userId)
		.first<{ version: number }>();
	return row?.version ?? 0;
}

async function getTransactionVersion(id: string, userId: string, DB: D1Database): Promise<number> {
	const row = await DB.prepare("SELECT version FROM transactions WHERE id = ? AND user_id = ?")
		.bind(id, userId)
		.first<{ version: number }>();
	return row?.version ?? 0;
}

async function getUserShareVersion(id: string, DB: D1Database): Promise<number> {
	const row = await DB.prepare("SELECT version FROM user_shares WHERE id = ?")
		.bind(id)
		.first<{ version: number }>();
	return row?.version ?? 0;
}

async function processUserShareEvent(
	event: PushEvent,
	userId: string,
	userEmail: string,
	DB: D1Database
): Promise<Response | null> {
	// Only handle POST action for SHR events
	if (event.action !== "POST") {
		return jsonResponse({ error: "SHR only supports POST action" }, { status: 400 });
	}

	const { payloadString, payloadObject } = parsePayload(event.payload);

	// 首先寫入前端送來的 POST 事件
	const postSyncPayload = JSON.stringify({
		action: "POST",
		version: 0,
		payload: payloadString,
	});
	await DB.prepare(
		"INSERT INTO sync_events (user_id, mutation_id, entity_type, entity_id, payload) VALUES (?, ?, ?, ?, ?)"
	)
		.bind(userId, event.mutation_id, event.entity_type, event.entity_id, postSyncPayload)
		.run();

	// Validate owner_id and owner_email match middleware info
	if (payloadObject?.owner_id !== userId || payloadObject?.owner_email !== userEmail) {
		// 驗證失敗，寫入 DELETE 事件
		const deleteMutationId = crypto.randomUUID();
		const deletePayload = JSON.stringify({
			action: "DELETE",
			version: 1,
			payload: null,
		});
		await DB.prepare(
			"INSERT INTO sync_events (user_id, mutation_id, entity_type, entity_id, payload) VALUES (?, ?, ?, ?, ?)"
		)
			.bind(userId, deleteMutationId, event.entity_type, event.entity_id, deletePayload)
			.run();
		return null;
	}

	const viewerEmail = payloadObject?.viewer_email;
	if (!isNonEmptyString(viewerEmail)) {
		// viewer_email 驗證失敗，寫入 DELETE 事件
		const deleteMutationId = crypto.randomUUID();
		const deletePayload = JSON.stringify({
			action: "DELETE",
			version: 1,
			payload: null,
		});
		await DB.prepare(
			"INSERT INTO sync_events (user_id, mutation_id, entity_type, entity_id, payload) VALUES (?, ?, ?, ?, ?)"
		)
			.bind(userId, deleteMutationId, event.entity_type, event.entity_id, deletePayload)
			.run();
		return null;
	}

	// Get viewer_id from users table by viewer_email
	const viewerUser = await DB.prepare("SELECT id FROM users WHERE email = ?")
		.bind(viewerEmail)
		.first<{ id: string }>();

	if (!viewerUser) {
		// Viewer not found, write DELETE event
		const deleteMutationId = crypto.randomUUID();
		const deletePayload = JSON.stringify({
			action: "DELETE",
			version: 1,
			payload: null,
		});
		await DB.prepare(
			"INSERT INTO sync_events (user_id, mutation_id, entity_type, entity_id, payload) VALUES (?, ?, ?, ?, ?)"
		)
			.bind(userId, deleteMutationId, event.entity_type, event.entity_id, deletePayload)
			.run();
		return null;
	}

	const viewerId = viewerUser.id;

	// Check if share already exists (is_deleted = 0)
	const existingShare = await DB.prepare(
		"SELECT id FROM user_shares WHERE owner_id = ? AND viewer_id = ? AND is_deleted = 0"
	)
		.bind(userId, viewerId)
		.first<{ id: string }>();

	if (existingShare) {
		// Share already exists, write DELETE event
		const deleteMutationId = crypto.randomUUID();
		const deletePayload = JSON.stringify({
			action: "DELETE",
			version: 1,
			payload: null,
		});
		await DB.prepare(
			"INSERT INTO sync_events (user_id, mutation_id, entity_type, entity_id, payload) VALUES (?, ?, ?, ?, ?)"
		)
			.bind(userId, deleteMutationId, event.entity_type, event.entity_id, deletePayload)
			.run();
		return null;
	}

	// 驗證全部通過，插入新的分享記錄
	const shareId = event.entity_id;
	const newVersion = 1;
	await DB.prepare(
		"INSERT INTO user_shares (id, owner_id, owner_email, viewer_id, viewer_email, status, version, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, 0)"
	)
		.bind(shareId, userId, userEmail, viewerId, viewerEmail, "PENDING", newVersion)
		.run();

	// 處理成功，寫入 PUT 事件（包含完整的 viewer_id）
	const putMutationId = crypto.randomUUID();
	const putPayloadString = JSON.stringify({
		id: shareId,
		owner_id: userId,
		owner_email: userEmail,
		viewer_id: viewerId,
		viewer_email: viewerEmail,
		status: "PENDING",
	});
	const putSyncPayload = JSON.stringify({
		action: "PUT",
		version: newVersion,
		payload: putPayloadString,
	});
	await DB.prepare(
		"INSERT INTO sync_events (user_id, mutation_id, entity_type, entity_id, payload) VALUES (?, ?, ?, ?, ?)"
	)
		.bind(userId, putMutationId, event.entity_type, event.entity_id, putSyncPayload)
		.run();

	return null;
}
