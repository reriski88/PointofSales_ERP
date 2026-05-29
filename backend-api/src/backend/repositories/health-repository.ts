import { sql } from "drizzle-orm";
import { db } from "@/db";

export const healthRepository = {
  ping() {
    return db.execute(sql`select 1`);
  },
};
