CREATE TABLE IF NOT EXISTS "inventory_batch" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "outlet_id" uuid NOT NULL,
  "sku_id" uuid NOT NULL,
  "lot_code" text NOT NULL,
  "expiry_date" date,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "initial_base_qty" numeric(18, 3) NOT NULL,
  "on_hand_base_qty" numeric(18, 3) NOT NULL,
  "unit_cost" numeric(14, 6),
  "source_type" text,
  "source_id" text,
  "source_item_id" text,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "inventory_batch" ADD CONSTRAINT "inventory_batch_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "inventory_batch" ADD CONSTRAINT "inventory_batch_outlet_id_outlet_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "outlet"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "inventory_batch" ADD CONSTRAINT "inventory_batch_sku_id_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "sku"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "inventory_batch_outlet_sku_expiry_idx" ON "inventory_batch" ("outlet_id", "sku_id", "expiry_date");
CREATE INDEX IF NOT EXISTS "inventory_batch_org_lot_idx" ON "inventory_batch" ("organization_id", "lot_code");

ALTER TABLE "stock_movement" ADD COLUMN IF NOT EXISTS "batch_id" uuid;

DO $$ BEGIN
 ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_batch_id_inventory_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "inventory_batch"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "purchase_order_item" ADD COLUMN IF NOT EXISTS "lot_code" text;
ALTER TABLE "purchase_order_item" ADD COLUMN IF NOT EXISTS "expiry_date" date;
