DO $$ BEGIN
  CREATE TYPE "public"."accounting_account_type" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense', 'cogs');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."accounting_normal_balance" AS ENUM('debit', 'credit');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."journal_entry_status" AS ENUM('posted', 'voided');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."cash_ledger_direction" AS ENUM('in', 'out');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounting_account" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "type" "accounting_account_type" NOT NULL,
  "normal_balance" "accounting_normal_balance" NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "journal_entry" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "outlet_id" uuid,
  "entry_number" text NOT NULL,
  "source_type" text NOT NULL,
  "source_id" text NOT NULL,
  "entry_date" timestamp with time zone DEFAULT now() NOT NULL,
  "description" text,
  "status" "journal_entry_status" DEFAULT 'posted' NOT NULL,
  "actor_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "journal_line" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "journal_entry_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "debit" numeric(14, 2) DEFAULT '0' NOT NULL,
  "credit" numeric(14, 2) DEFAULT '0' NOT NULL,
  "memo" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cash_bank_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "outlet_id" uuid,
  "account_id" uuid,
  "journal_entry_id" uuid,
  "source_type" text NOT NULL,
  "source_id" text NOT NULL,
  "method" "payment_method" NOT NULL,
  "direction" "cash_ledger_direction" NOT NULL,
  "amount" numeric(14, 2) NOT NULL,
  "description" text,
  "actor_user_id" text,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "operational_expense" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "outlet_id" uuid,
  "expense_number" text NOT NULL,
  "expense_account_id" uuid,
  "paid_from_account_id" uuid,
  "method" "payment_method" DEFAULT 'cash' NOT NULL,
  "amount" numeric(14, 2) NOT NULL,
  "vendor" text,
  "description" text NOT NULL,
  "expense_date" timestamp with time zone DEFAULT now() NOT NULL,
  "actor_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "accounting_account" ADD CONSTRAINT "accounting_account_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_outlet_id_outlet_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlet"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_journal_entry_id_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entry"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_account_id_accounting_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounting_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "cash_bank_ledger" ADD CONSTRAINT "cash_bank_ledger_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "cash_bank_ledger" ADD CONSTRAINT "cash_bank_ledger_outlet_id_outlet_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlet"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "cash_bank_ledger" ADD CONSTRAINT "cash_bank_ledger_account_id_accounting_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounting_account"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "cash_bank_ledger" ADD CONSTRAINT "cash_bank_ledger_journal_entry_id_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entry"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "cash_bank_ledger" ADD CONSTRAINT "cash_bank_ledger_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "operational_expense" ADD CONSTRAINT "operational_expense_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "operational_expense" ADD CONSTRAINT "operational_expense_outlet_id_outlet_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlet"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "operational_expense" ADD CONSTRAINT "operational_expense_expense_account_id_accounting_account_id_fk" FOREIGN KEY ("expense_account_id") REFERENCES "public"."accounting_account"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "operational_expense" ADD CONSTRAINT "operational_expense_paid_from_account_id_accounting_account_id_fk" FOREIGN KEY ("paid_from_account_id") REFERENCES "public"."accounting_account"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "operational_expense" ADD CONSTRAINT "operational_expense_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "accounting_account_org_code_idx" ON "accounting_account" USING btree ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "journal_entry_number_idx" ON "journal_entry" USING btree ("organization_id","entry_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "journal_entry_source_idx" ON "journal_entry" USING btree ("organization_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "journal_line_entry_idx" ON "journal_line" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cash_bank_ledger_source_idx" ON "cash_bank_ledger" USING btree ("organization_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cash_bank_ledger_date_idx" ON "cash_bank_ledger" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "operational_expense_number_idx" ON "operational_expense" USING btree ("organization_id","expense_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "operational_expense_date_idx" ON "operational_expense" USING btree ("organization_id","expense_date");
