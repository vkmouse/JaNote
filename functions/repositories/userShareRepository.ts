import type { UserShare } from '../types';

export async function getUserShareVersion(id: string, DB: D1Database): Promise<number> {
  const row = await DB.prepare('SELECT version FROM user_shares WHERE id = ?')
    .bind(id)
    .first<{ version: number }>();
  return row?.version ?? 0;
}

export async function getUserShareById(id: string, DB: D1Database): Promise<UserShare | null> {
  return await DB.prepare('SELECT * FROM user_shares WHERE id = ? AND is_deleted = 0')
    .bind(id)
    .first<UserShare>();
}

export async function getActiveUserShare(
  ownerId: string,
  viewerId: string,
  DB: D1Database
): Promise<UserShare | null> {
  return await DB.prepare(
    'SELECT * FROM user_shares WHERE owner_id = ? AND viewer_id = ? AND is_deleted = 0'
  )
    .bind(ownerId, viewerId)
    .first<UserShare>();
}

export async function createUserShare(
  id: string,
  ownerId: string,
  ownerEmail: string,
  viewerId: string,
  viewerEmail: string,
  status: string,
  version: number,
  DB: D1Database
): Promise<void> {
  await DB.prepare(
    'INSERT INTO user_shares (id, owner_id, owner_email, viewer_id, viewer_email, status, version, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
  )
    .bind(id, ownerId, ownerEmail, viewerId, viewerEmail, status, version)
    .run();
}

export async function updateUserShareStatus(
  id: string,
  status: string,
  version: number,
  DB: D1Database
): Promise<void> {
  await DB.prepare('UPDATE user_shares SET status = ?, version = ? WHERE id = ?')
    .bind(status, version, id)
    .run();
}

export async function deleteUserShare(id: string, version: number, DB: D1Database): Promise<void> {
  await DB.prepare('UPDATE user_shares SET version = ?, is_deleted = 1 WHERE id = ?')
    .bind(version, id)
    .run();
}

export async function dropUserSharesTable(DB: D1Database): Promise<void> {
  await DB.prepare(`DROP TABLE IF EXISTS user_shares`).run();
}

export async function createUserSharesTable(DB: D1Database): Promise<void> {
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS user_shares (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      viewer_id TEXT,
      viewer_email TEXT NOT NULL,
      status TEXT NOT NULL,
      version INTEGER NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0
    )
  `).run();
}
