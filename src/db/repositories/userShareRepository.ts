import { db } from "../index";
import type { UserShare } from "../../types";

async function getAll(): Promise<UserShare[]> {
  return db.user_shares.toArray();
}

async function upsert(userShare: UserShare): Promise<void> {
  await db.user_shares.put(userShare);
}

async function update(
  id: string,
  updater: (current: UserShare | undefined) => UserShare | null,
): Promise<void> {
  await db.transaction("rw", db.user_shares, async () => {
    const current = await db.user_shares.get(id);
    const updated = updater(current);
    if (updated) await db.user_shares.put(updated);
  });
}

async function deleteAll(): Promise<void> {
  await db.user_shares.clear();
}

export const userShareRepository = {
  getAll,
  upsert,
  update,
  deleteAll,
};
