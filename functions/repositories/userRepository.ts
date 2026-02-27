import type { User } from '../types';

export async function getUserByEmail(email: string, DB: D1Database): Promise<User | null> {
  return await DB.prepare('SELECT id, email, created_at, updated_at FROM users WHERE email = ?')
    .bind(email)
    .first<User>();
}

export async function getUserById(id: string, DB: D1Database): Promise<User | null> {
  return await DB.prepare('SELECT id, email, created_at, updated_at FROM users WHERE id = ?')
    .bind(id)
    .first<User>();
}

export async function createUser(id: string, email: string, DB: D1Database): Promise<void> {
  const now = new Date().toISOString();
  await DB.prepare('INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .bind(id, email, now, now)
    .run();
}

export async function getUserIdByEmail(email: string, DB: D1Database): Promise<string> {
  const existing = await DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string }>();
  
  if (existing) {
    return existing.id;
  }
  
  const userId = crypto.randomUUID();
  await createUser(userId, email, DB);
  
  return userId;
}

export async function dropUsersTable(DB: D1Database): Promise<void> {
  await DB.prepare(`DROP TABLE IF EXISTS users`).run();
}

export async function createUsersTable(DB: D1Database): Promise<void> {
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}
