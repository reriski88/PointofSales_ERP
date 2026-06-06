import "dotenv/config";
import { auth } from "@/lib/auth";
import { pool } from "@/db";

const adminEmail = process.env.SEED_OWNER_EMAIL ?? "admin@email.com";
const adminPassword = process.env.SEED_OWNER_PASSWORD ?? "Pwd!12345.";
const adminName = process.env.SEED_OWNER_NAME ?? "Admin POS Cemilan";

async function main() {
  const client = await pool.connect();
  try {
    let orgId: string | null = null;
    const existingAdmin = await client.query<{ id: string; organization_id: string | null }>(
      'select id, organization_id from "user" where email = $1 limit 1',
      [adminEmail],
    );
    orgId = existingAdmin.rows[0]?.organization_id ?? null;

    if (!orgId) {
      const existingOrg = await client.query<{ id: string }>('select id from "organization" limit 1');
      orgId = existingOrg.rows[0]?.id ?? null;
    }

    if (!orgId) {
      const createdOrg = await client.query<{ id: string }>(
        'insert into "organization" (name, created_at, updated_at) values ($1, now(), now()) returning id',
        ["POS Cemilan"],
      );
      orgId = createdOrg.rows[0].id;
    }

    await client.query("begin");
    const tableRows = await client.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' and tablename not in ('organization', 'user', 'account')",
    );
    if (tableRows.rows.length) {
      const tableNames = tableRows.rows
        .map((row) => `"public"."${row.tablename.replaceAll('"', '""')}"`)
        .join(", ");
      await client.query(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`);
    }
    await client.query('delete from "user" where email <> $1', [adminEmail]);
    await client.query(
      'delete from "account" where user_id not in (select id from "user" where email = $1)',
      [adminEmail],
    );
    await client.query("commit");

    let admin = await client.query<{ id: string }>('select id from "user" where email = $1 limit 1', [adminEmail]);
    if (!admin.rows[0]) {
      await auth.api.signUpEmail({
        body: {
          email: adminEmail,
          password: adminPassword,
          name: adminName,
        },
      });
      admin = await client.query<{ id: string }>('select id from "user" where email = $1 limit 1', [adminEmail]);
    }

    if (!admin.rows[0]) {
      throw new Error(`Admin ${adminEmail} tidak bisa dibuat/ditemukan.`);
    }

    await client.query(
      'update "user" set name = $1, role = $2, is_active = true, organization_id = $3, email_verified = true, updated_at = now() where email = $4',
      [adminName, "owner", orgId, adminEmail],
    );
    await client.query('TRUNCATE TABLE "audit_log", "outlet" RESTART IDENTITY CASCADE');

    console.log("Data aplikasi dikosongkan.");
    console.log(`Admin tersisa: ${adminEmail}`);
    console.log(`Password admin: ${adminPassword}`);
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
