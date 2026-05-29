import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/backend/database/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://pos_cemilan:pos_cemilan@localhost:5432/pos_cemilan",
  },
  verbose: true,
  strict: true,
});
