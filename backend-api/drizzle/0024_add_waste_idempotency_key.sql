ALTER TABLE "waste_adjustment" ADD COLUMN IF NOT EXISTS "idempotency_key" text;

CREATE UNIQUE INDEX IF NOT EXISTS "waste_idempotency_idx"
ON "waste_adjustment"("organization_id", "idempotency_key")
WHERE "idempotency_key" IS NOT NULL;
