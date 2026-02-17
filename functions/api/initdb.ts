export const onRequest: PagesFunction = async (context) => {
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
        display_name TEXT,
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

    const demoUserId = 'demo-user';
    await DB.prepare(
      `INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)`
    )
      .bind(demoUserId, 'demo-user', 'Demo User')
      .run();

    const expenseCategories = [
      '早餐',
      '午餐',
      '晚餐',
      '飲品',
      '點心',
      '交通',
      '購物',
      '娛樂',
      '日用品',
      '房租',
    ];
    const incomeCategories = ['薪水', '獎金', '利息'];

    for (const name of expenseCategories) {
      const id = `cat-expense-${name}`;
      await DB.prepare(
        `INSERT OR IGNORE INTO categories (id, user_id, name, type, version, is_deleted) VALUES (?, ?, ?, ?, ?, 0)`
      )
        .bind(id, demoUserId, name, 'EXPENSE', 1)
        .run();

      const payload = JSON.stringify({
        action: 'PUT',
        version: 1,
        payload: JSON.stringify({
          id,
          user_id: demoUserId,
          name,
          type: 'EXPENSE',
        }),
      });

      await DB.prepare(
        `INSERT OR IGNORE INTO sync_events (user_id, mutation_id, entity_type, entity_id, payload) VALUES (?, ?, ?, ?, ?)`
      )
        .bind(demoUserId, `init-cat-${id}`, 'CAT', id, payload)
        .run();
    }

    for (const name of incomeCategories) {
      const id = `cat-income-${name}`;
      await DB.prepare(
        `INSERT OR IGNORE INTO categories (id, user_id, name, type, version, is_deleted) VALUES (?, ?, ?, ?, ?, 0)`
      )
        .bind(id, demoUserId, name, 'INCOME', 1)
        .run();

      const payload = JSON.stringify({
        action: 'PUT',
        version: 1,
        payload: JSON.stringify({
          id,
          user_id: demoUserId,
          name,
          type: 'INCOME',
        }),
      });

      await DB.prepare(
        `INSERT OR IGNORE INTO sync_events (user_id, mutation_id, entity_type, entity_id, payload) VALUES (?, ?, ?, ?, ?)`
      )
        .bind(demoUserId, `init-cat-${id}`, 'CAT', id, payload)
        .run();
    }

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