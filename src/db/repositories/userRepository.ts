import { db } from "../index";
import type { User } from "../../types";

async function get(): Promise<User | null> {
  const users = await db.user.toArray();
  return users[0] ?? null;
}

async function set(user: User): Promise<void> {
  await db.user.clear();
  await db.user.put(user);
}

async function clear(): Promise<void> {
  await db.user.clear();
}

export const userRepository = { get, set, clear };
