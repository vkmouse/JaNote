import type { UserShare } from "../types";

export async function getUserShareVersion(
  id: string,
  DB: D1Database,
): Promise<number> {
  const row = await DB.prepare("SELECT version FROM user_shares WHERE id = ?")
    .bind(id)
    .first<{ version: number }>();
  return row?.version ?? 0;
}

export async function getUserShareById(
  id: string,
  DB: D1Database,
): Promise<UserShare | null> {
  return await DB.prepare(
    "SELECT * FROM user_shares WHERE id = ? AND is_deleted = 0",
  )
    .bind(id)
    .first<UserShare>();
}

export async function getActiveUserShare(
  senderId: string,
  receiverId: string,
  DB: D1Database,
): Promise<UserShare | null> {
  return await DB.prepare(
    "SELECT * FROM user_shares WHERE sender_id = ? AND receiver_id = ? AND status = 'ACTIVE' AND is_deleted = 0",
  )
    .bind(senderId, receiverId)
    .first<UserShare>();
}

export async function getActiveOwnersByViewerId(
  receiverId: string,
  DB: D1Database,
): Promise<UserShare[]> {
  const results = await DB.prepare(
    "SELECT * FROM user_shares WHERE receiver_id = ? AND status = 'ACTIVE' AND is_deleted = 0",
  )
    .bind(receiverId)
    .all<UserShare>();
  return results.results || [];
}

export async function createUserShare(
  id: string,
  senderId: string,
  senderEmail: string,
  receiverId: string,
  receiverEmail: string,
  status: string,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    "INSERT INTO user_shares (id, sender_id, sender_email, receiver_id, receiver_email, status, version, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, 0)",
  )
    .bind(id, senderId, senderEmail, receiverId, receiverEmail, status, version)
    .run();
}

export async function updateUserShareStatus(
  id: string,
  status: string,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    "UPDATE user_shares SET status = ?, version = ? WHERE id = ?",
  )
    .bind(status, version, id)
    .run();
}

export async function deleteUserShare(
  id: string,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    "UPDATE user_shares SET version = ?, is_deleted = 1 WHERE id = ?",
  )
    .bind(version, id)
    .run();
}

export async function dropUserSharesTable(DB: D1Database): Promise<void> {
  await DB.prepare(`DROP TABLE IF EXISTS user_shares`).run();
}

export async function createUserSharesTable(DB: D1Database): Promise<void> {
  await DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS user_shares (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      sender_email TEXT NOT NULL,
      receiver_id TEXT,
      receiver_email TEXT NOT NULL,
      status TEXT NOT NULL,
      version INTEGER NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0
    )
  `,
  ).run();
}
