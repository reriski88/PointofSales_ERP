DO $$ BEGIN
  CREATE TYPE "public"."stock_opname_status" AS ENUM('draft', 'counted', 'approved', 'posted', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_opname" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "outlet_id" uuid NOT NULL,
  "code" text NOT NULL,
  "status" "stock_opname_status" DEFAULT 'draft' NOT NULL,
  "note" text,
  "created_by_user_id" text,
  "submitted_by_user_id" text,
  "approved_by_user_id" text,
  "posted_by_user_id" text,
  "submitted_at" timestamp with time zone,
  "approved_at" timestamp with time zone,
  "posted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_opname_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "stock_opname_id" uuid NOT NULL,
  "sku_id" uuid NOT NULL,
  "name_snapshot" text NOT NULL,
  "unit_id" uuid NOT NULL,
  "system_base_qty" numeric(18, 3) DEFAULT '0' NOT NULL,
  "physical_base_qty" numeric(18, 3),
  "difference_base_qty" numeric(18, 3),
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_opname" ADD CONSTRAINT "stock_opname_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_opname" ADD CONSTRAINT "stock_opname_outlet_id_outlet_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlet"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_opname" ADD CONSTRAINT "stock_opname_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_opname" ADD CONSTRAINT "stock_opname_submitted_by_user_id_user_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_opname" ADD CONSTRAINT "stock_opname_approved_by_user_id_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_opname" ADD CONSTRAINT "stock_opname_posted_by_user_id_user_id_fk" FOREIGN KEY ("posted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_opname_item" ADD CONSTRAINT "stock_opname_item_stock_opname_id_stock_opname_id_fk" FOREIGN KEY ("stock_opname_id") REFERENCES "public"."stock_opname"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_opname_item" ADD CONSTRAINT "stock_opname_item_sku_id_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."sku"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_opname_item" ADD CONSTRAINT "stock_opname_item_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_opname_code_idx" ON "stock_opname" USING btree ("organization_id","code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_opname_outlet_created_idx" ON "stock_opname" USING btree ("outlet_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_opname_item_unique_idx" ON "stock_opname_item" USING btree ("stock_opname_id","sku_id");
