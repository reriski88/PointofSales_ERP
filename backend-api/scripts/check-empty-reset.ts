import "dotenv/config";
import { pool } from "@/db";

const tables = [
  "organization",
  "user",
  "account",
  "outlet",
  "unit",
  "product",
  "sku",
  "inventory_balance",
  "sale",
  "shift",
  "audit_log",
];

for (const table of tables) {
  const result = await pool.query<{ count: number }>(`select count(*)::int as count from "${table}"`);
  console.log(`${table}: ${result.rows[0].count}`);
}

await pool.end();
