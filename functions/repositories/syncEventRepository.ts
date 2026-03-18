import type { SyncEvent } from "../types";

export async function getSyncEventByMutationId(
  mutationId: string,
  DB: D1Database,
): Promise<{ id: number } | null> {
  return await DB.prepare("SELECT id FROM sync_events WHERE mutation_id = ?")
    .bind(mutationId)
    .first<{ id: number }>();
}

export async function getMaxSyncEventId(
  userId: string,
  DB: D1Database,
): Promise<number> {
  const row = await DB.prepare(
    "SELECT MAX(id) as max_id FROM sync_events WHERE user_id = ?",
  )
    .bind(userId)
    .first<{ max_id: number | null }>();
  return row?.max_id ?? 0;
}

export async function insertSyncEvent(
  userId: string,
  mutationId: string,
  entityType: string,
  entityId: string,
  payload: string | null,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    "INSERT INTO sync_events (user_id, mutation_id, entity_type, entity_id, payload) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(userId, mutationId, entityType, entityId, payload)
    .run();
}

export async function getPullEvents(
  userId: string,
  lastCursor: number,
  excludeMutationIds: string[],
  DB: D1Database,
): Promise<any[]> {
  let query =
    "SELECT id, mutation_id, entity_type, entity_id, payload FROM sync_events WHERE user_id = ? AND id > ?";
  const binds: unknown[] = [userId, lastCursor];

  if (excludeMutationIds.length > 0) {
    const placeholders = excludeMutationIds.map(() => "?").join(", ");
    query += ` AND mutation_id NOT IN (${placeholders})`;
    binds.push(...excludeMutationIds);
  }
  query += " ORDER BY id ASC";

  const results = await DB.prepare(query)
    .bind(...binds)
    .all();
  return results.results || [];
}

export async function getPullEventsForSharedUsers(
  sharedUserIds: string[],
  lastCursor: number,
  excludeMutationIds: string[],
  DB: D1Database,
): Promise<any[]> {
  if (sharedUserIds.length === 0) return [];

  const userPlaceholders = sharedUserIds.map(() => "?").join(", ");
  let query = `SELECT id, mutation_id, entity_type, entity_id, payload FROM sync_events WHERE user_id IN (${userPlaceholders}) AND id > ? AND entity_type IN ('CAT', 'TXN', 'BGT', 'RTXN', 'RBGT')`;
  const binds: unknown[] = [...sharedUserIds, lastCursor];

  if (excludeMutationIds.length > 0) {
    const placeholders = excludeMutationIds.map(() => "?").join(", ");
    query += ` AND mutation_id NOT IN (${placeholders})`;
    binds.push(...excludeMutationIds);
  }
  query += " ORDER BY id ASC";

  const results = await DB.prepare(query)
    .bind(...binds)
    .all();
  return results.results || [];
}

export async function getMaxSyncEventIdForUsers(
  userIds: string[],
  DB: D1Database,
): Promise<number> {
  if (userIds.length === 0) return 0;
  const placeholders = userIds.map(() => "?").join(", ");
  const row = await DB.prepare(
    `SELECT MAX(id) as max_id FROM sync_events WHERE user_id IN (${placeholders})`,
  )
    .bind(...userIds)
    .first<{ max_id: number | null }>();
  return row?.max_id ?? 0;
}

export async function dropSyncEventsTable(DB: D1Database): Promise<void> {
  await DB.prepare(`DROP TABLE IF EXISTS sync_events`).run();
}

export async function createSyncEventsTable(DB: D1Database): Promise<void> {
  await DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS sync_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      mutation_id TEXT UNIQUE NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();
}
