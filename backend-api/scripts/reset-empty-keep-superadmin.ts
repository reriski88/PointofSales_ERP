import "dotenv/config";
import { auth } from "@/lib/auth";
import { pool } from "@/db";

const superadminEmail = process.env.SEED_SUPERADMIN_EMAIL ?? "it@email.com";
const superadminPassword = process.env.SEED_SUPERADMIN_PASSWORD ?? "Pwd!12345.";
const superadminName = process.env.SEED_SUPERADMIN_NAME ?? "IT Support";

async function main() {
  const client = await pool.connect();
  try {
    let superadmin = await client.query<{ id: string }>('select id from "user" where email = $1 limit 1', [
      superadminEmail,
    ]);

    if (!superadmin.rows[0]) {
      await auth.api.signUpEmail({
        body: {
          email: superadminEmail,
          password: superadminPassword,
          name: superadminName,
        },
      });
      superadmin = await client.query<{ id: string }>('select id from "user" where email = $1 limit 1', [
        superadminEmail,
      ]);
    }

    const superadminId = superadmin.rows[0]?.id;
    if (!superadminId) {
      throw new Error(`Superadmin ${superadminEmail} tidak bisa dibuat/ditemukan.`);
    }

    await client.query("begin");

    await client.query(
      'update "user" set name = $1, role = $2, is_active = true, organization_id = null, email_verified = true, updated_at = now() where id = $3',
      [superadminName, "superadmin", superadminId],
    );

    const tableRows = await client.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' and tablename not in ('user', 'account', 'organization')",
    );
    if (tableRows.rows.length) {
      const tableNames = tableRows.rows
        .map((row) => `"public"."${row.tablename.replaceAll('"', '""')}"`)
        .join(", ");
      await client.query(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`);
    }

    await client.query('delete from "account" where user_id <> $1', [superadminId]);
    await client.query('delete from "user" where id <> $1', [superadminId]);
    await client.query('delete from "organization"');

    await client.query("commit");

    console.log("Data aplikasi dikosongkan.");
    console.log(`Superadmin tersisa: ${superadminEmail}`);
    console.log(`Password superadmin: ${superadminPassword}`);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
