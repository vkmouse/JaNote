import Dexie from "dexie";
import type { AppDB } from "./tables";
import { schema } from "./tables";

export const db = new Dexie("sync-ui") as Dexie & AppDB;

db.version(1).stores(schema);
