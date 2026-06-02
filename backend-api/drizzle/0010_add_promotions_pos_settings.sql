CREATE TYPE "public"."promotion_type" AS ENUM('transaction_discount', 'item_discount', 'buy_x_get_y');--> statement-breakpoint
CREATE TYPE "public"."promotion_discount_type" AS ENUM('percent', 'amount');--> statement-breakpoint
CREATE TYPE "public"."promotion_scope" AS ENUM('all', 'sku', 'category');--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "pos_settings" jsonb;--> statement-breakpoint
CREATE TABLE "promotion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"type" "promotion_type" NOT NULL,
	"discount_type" "promotion_discount_type" DEFAULT 'amount' NOT NULL,
	"discount_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"scope" "promotion_scope" DEFAULT 'all' NOT NULL,
	"target_sku_id" uuid,
	"target_category" text,
	"outlet_ids" jsonb,
	"min_subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"buy_qty" numeric(18, 3) DEFAULT '0' NOT NULL,
	"get_qty" numeric(18, 3) DEFAULT '0' NOT NULL,
	"max_redemptions" integer,
	"redeemed_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_promotion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"promotion_id" uuid,
	"code_snapshot" text,
	"name_snapshot" text NOT NULL,
	"type_snapshot" text NOT NULL,
	"discount_total" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "promotion" ADD CONSTRAINT "promotion_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion" ADD CONSTRAINT "promotion_target_sku_id_sku_id_fk" FOREIGN KEY ("target_sku_id") REFERENCES "public"."sku"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_promotion" ADD CONSTRAINT "sale_promotion_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_promotion" ADD CONSTRAINT "sale_promotion_promotion_id_promotion_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotion"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_org_code_idx" ON "promotion" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "promotion_org_active_idx" ON "promotion" USING btree ("organization_id","is_active");
