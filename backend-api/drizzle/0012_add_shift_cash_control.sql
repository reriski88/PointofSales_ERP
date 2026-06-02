DO $$ BEGIN
  CREATE TYPE "public"."shift_cash_movement_type" AS ENUM('cash_in', 'cash_out');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."shift_close_approval_status" AS ENUM('normal', 'variance_pending', 'variance_approved');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "shift" ADD COLUMN IF NOT EXISTS "cash_in_total" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "shift" ADD COLUMN IF NOT EXISTS "cash_out_total" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "shift" ADD COLUMN IF NOT EXISTS "cash_variance" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "shift" ADD COLUMN IF NOT EXISTS "close_approval_status" "shift_close_approval_status" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "shift" ADD COLUMN IF NOT EXISTS "closed_by_user_id" text;--> statement-breakpoint
ALTER TABLE "shift" ADD COLUMN IF NOT EXISTS "supervisor_user_id" text;--> statement-breakpoint
ALTER TABLE "shift" ADD COLUMN IF NOT EXISTS "variance_reason" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_cash_movement" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "outlet_id" uuid NOT NULL,
  "shift_id" uuid NOT NULL,
  "type" "shift_cash_movement_type" NOT NULL,
  "amount" numeric(14, 2) NOT NULL,
  "reason" text NOT NULL,
  "note" text,
  "actor_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shift" ADD CONSTRAINT "shift_closed_by_user_id_user_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shift" ADD CONSTRAINT "shift_supervisor_user_id_user_id_fk" FOREIGN KEY ("supervisor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shift_cash_movement" ADD CONSTRAINT "shift_cash_movement_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shift_cash_movement" ADD CONSTRAINT "shift_cash_movement_outlet_id_outlet_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlet"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shift_cash_movement" ADD CONSTRAINT "shift_cash_movement_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shift_cash_movement" ADD CONSTRAINT "shift_cash_movement_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shift_cash_movement_shift_idx" ON "shift_cash_movement" USING btree ("shift_id","created_at");
