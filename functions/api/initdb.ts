interface Env {
  DB: D1Database;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;

  try {
    // Drop existing tables to ensure clean state
    await DB.prepare(`DROP TABLE IF EXISTS sync_events`).run();
    await DB.prepare(`DROP TABLE IF EXISTS transactions`).run();
    await DB.prepare(`DROP TABLE IF EXISTS categories`).run();
    await DB.prepare(`DROP TABLE IF EXISTS users`).run();

    // Create users table
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Create categories table
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        version INTEGER NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0
      )
    `).run();

    // Create transactions table
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        note TEXT,
        date BIGINT NOT NULL,
        version INTEGER NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0
      )
    `).run();

    // Create sync_events table
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS sync_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        mutation_id TEXT UNIQUE NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    return new Response(JSON.stringify({ message: "Database initialized successfully" }), {
      headers: { "content-type": "application/json" },
      status: 200
    });
  } catch (error) {
    console.error("Error initializing database:", error);
    return new Response(JSON.stringify({ error: "Failed to initialize database" }), {
      headers: { "content-type": "application/json" },
      status: 500
    });
  }
};