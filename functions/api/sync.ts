interface Env {
	DB: D1Database;
}

type EntityType = "CAT" | "TXN";

type ActionType = "PUT" | "DELETE";

type EntryType = "EXPENSE" | "INCOME";

interface SyncRequest {
	user_id: string;
	last_cursor: number;
	push_events?: PushEvent[];
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

export const onRequest: PagesFunction<Env> = async (context) => {
	const { DB } = context.env;
	if (context.request.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405 });
	}

	let body: SyncRequest;
	try {
		body = (await context.request.json()) as SyncRequest;
	} catch {
		return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
	}

	if (!isNonEmptyString(body?.user_id)) {
		return jsonResponse({ error: "user_id is required" }, { status: 400 });
	}
	if (!isNumber(body?.last_cursor)) {
		return jsonResponse({ error: "last_cursor must be a number" }, { status: 400 });
	}

	const userId = body.user_id.trim();
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
			} else {
				errorResponse = await processTransactionEvent(event, userId, DB);
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
	const pullEvents: PullEvent[] = pullResults.results.map((row: any) => {
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
	const priority: Record<EntityType, number> = { CAT: 0, TXN: 1 };
	return [...events].sort((a, b) => priority[a.entity_type] - priority[b.entity_type]);
}

function isValidEntityType(value: unknown): value is EntityType {
	return value === "CAT" || value === "TXN";
}

function isValidAction(value: unknown): value is ActionType {
	return value === "PUT" || value === "DELETE";
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
		const payloadUserId = payloadObject?.user_id;
		const type = payloadObject?.type;

		if (!isNonEmptyString(name)) {
			return jsonResponse({ error: "Category name is required" }, { status: 400 });
		}

		if (!isValidEntryType(type)) {
			return jsonResponse({ error: "Category type is required" }, { status: 400 });
		}

		if (payloadUserId !== undefined && payloadUserId !== userId) {
			return jsonResponse({ error: "payload user_id mismatch" }, { status: 400 });
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
		const payloadUserId = payloadObject?.user_id;
		if (payloadUserId !== undefined && payloadUserId !== userId) {
			return jsonResponse({ error: "payload user_id mismatch" }, { status: 400 });
		}

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
