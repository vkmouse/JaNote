import type { Env } from "../types";
import {
  dropUsersTable,
  createUsersTable,
} from "../repositories/userRepository";
import {
  dropCategoriesTable,
  createCategoriesTable,
} from "../repositories/categoryRepository";
import {
  dropTransactionsTable,
  createTransactionsTable,
} from "../repositories/transactionRepository";
import {
  dropUserSharesTable,
  createUserSharesTable,
} from "../repositories/userShareRepository";
import {
  dropBudgetsTable,
  createBudgetsTable,
} from "../repositories/budgetRepository";
import {
  dropSyncEventsTable,
  createSyncEventsTable,
} from "../repositories/syncEventRepository";

export const onRequest: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;

  try {
    // Drop existing tables to ensure clean state
    await dropSyncEventsTable(DB);
    await dropBudgetsTable(DB);
    await dropTransactionsTable(DB);
    await dropCategoriesTable(DB);
    await dropUserSharesTable(DB);
    await dropUsersTable(DB);

    // Create tables
    await createUsersTable(DB);
    await createCategoriesTable(DB);
    await createTransactionsTable(DB);
    await createUserSharesTable(DB);
    await createBudgetsTable(DB);
    await createSyncEventsTable(DB);

    return new Response(
      JSON.stringify({ message: "Database initialized successfully" }),
      {
        headers: { "content-type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error initializing database:", error);
    return new Response(
      JSON.stringify({ error: "Failed to initialize database" }),
      {
        headers: { "content-type": "application/json" },
        status: 500,
      },
    );
  }
};
