import { db } from "../index";

async function getLastCursor(): Promise<number> {
  const record = await db.sync_meta.get("last_cursor");
  if (!record?.value) return 0;
  const parsed = Number(record.value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function setLastCursor(value: number): Promise<void> {
  await db.sync_meta.put({ key: "last_cursor", value: String(value) });
}

async function clear(): Promise<void> {
  await db.sync_meta.clear();
}

export const syncMetaRepository = {
  getLastCursor,
  setLastCursor,
  clear,
};
