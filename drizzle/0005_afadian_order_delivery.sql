ALTER TABLE "afadian_orders"
  ADD COLUMN IF NOT EXISTS "planId" text,
  ADD COLUMN IF NOT EXISTS "planTitle" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "orderMonths" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "amount" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "messageStatus" text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "messageAttempts" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "messageAttemptedAt" timestamp,
  ADD COLUMN IF NOT EXISTS "messageSentAt" timestamp,
  ADD COLUMN IF NOT EXISTS "messageLastError" text;

ALTER TABLE "redeem_codes"
  ADD COLUMN IF NOT EXISTS "afadianOrderId" text;

UPDATE "afadian_orders"
SET "messageStatus" = 'not_requested'
WHERE "messageStatus" = 'pending' AND "createdAt" < now();

ALTER TABLE "afadian_orders" DROP CONSTRAINT IF EXISTS "afadian_orders_months_valid";
ALTER TABLE "afadian_orders" DROP CONSTRAINT IF EXISTS "afadian_orders_message_status_valid";
ALTER TABLE "afadian_orders"
  ADD CONSTRAINT "afadian_orders_months_valid" CHECK ("orderMonths" > 0),
  ADD CONSTRAINT "afadian_orders_message_status_valid" CHECK ("messageStatus" IN ('pending', 'sending', 'sent', 'failed', 'unknown', 'not_requested'));

CREATE INDEX IF NOT EXISTS "afadian_orders_created_idx" ON "afadian_orders" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "redeem_codes_afadian_order_idx" ON "redeem_codes" ("afadianOrderId");
