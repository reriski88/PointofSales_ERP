UPDATE "product" SET "void_window_hours" = 0 WHERE "void_window_hours" IS NULL;--> statement-breakpoint
UPDATE "product" SET "refund_window_hours" = 0 WHERE "refund_window_hours" IS NULL;--> statement-breakpoint
ALTER TABLE "product" ALTER COLUMN "void_window_hours" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "product" ALTER COLUMN "refund_window_hours" SET DEFAULT 0;
