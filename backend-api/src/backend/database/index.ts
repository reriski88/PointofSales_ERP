import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const rawConnectionString = process.env.DATABASE_URL ?? "postgres://pos_cemilan:pos_cemilan@localhost:5432/pos_cemilan";
const connectionString =
  /\bsslmode=(prefer|require|verify-ca)\b/.test(rawConnectionString) && !/\buselibpqcompat=true\b/.test(rawConnectionString)
    ? `${rawConnectionString}${rawConnectionString.includes("?") ? "&" : "?"}uselibpqcompat=true`
    : rawConnectionString;

export const pool = new Pool({
  connectionString,
});

export const db = drizzle(pool, { schema });

export type Database = typeof db;
