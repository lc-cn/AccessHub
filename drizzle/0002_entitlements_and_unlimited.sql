ALTER TABLE "groups"
  ALTER COLUMN "dailyLimit" SET DEFAULT -1,
  ALTER COLUMN "weeklyLimit" SET DEFAULT -1,
  ALTER COLUMN "monthlyLimit" SET DEFAULT -1;

UPDATE "groups" SET "dailyLimit" = -1 WHERE "dailyLimit" IS NULL;
UPDATE "groups" SET "weeklyLimit" = -1 WHERE "weeklyLimit" IS NULL;
UPDATE "groups" SET "monthlyLimit" = -1 WHERE "monthlyLimit" IS NULL;

ALTER TABLE "groups"
  ALTER COLUMN "dailyLimit" SET NOT NULL,
  ALTER COLUMN "weeklyLimit" SET NOT NULL,
  ALTER COLUMN "monthlyLimit" SET NOT NULL;

ALTER TABLE "groups" DROP CONSTRAINT IF EXISTS "groups_weekly_limit_positive";
ALTER TABLE "groups" DROP CONSTRAINT IF EXISTS "groups_monthly_limit_positive";
ALTER TABLE "groups" DROP CONSTRAINT IF EXISTS "groups_rate_limit_valid";
ALTER TABLE "groups" DROP CONSTRAINT IF EXISTS "groups_daily_limit_valid";
ALTER TABLE "groups" DROP CONSTRAINT IF EXISTS "groups_weekly_limit_valid";
ALTER TABLE "groups" DROP CONSTRAINT IF EXISTS "groups_monthly_limit_valid";

ALTER TABLE "groups"
  ADD CONSTRAINT "groups_rate_limit_valid" CHECK ("rateLimit" = -1 OR "rateLimit" > 0),
  ADD CONSTRAINT "groups_daily_limit_valid" CHECK ("dailyLimit" = -1 OR "dailyLimit" > 0),
  ADD CONSTRAINT "groups_weekly_limit_valid" CHECK ("weeklyLimit" = -1 OR "weeklyLimit" > 0),
  ADD CONSTRAINT "groups_monthly_limit_valid" CHECK ("monthlyLimit" = -1 OR "monthlyLimit" > 0);

ALTER TABLE "redeem_codes"
  ALTER COLUMN "groupId" DROP NOT NULL,
  ALTER COLUMN "durationDays" SET DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'group',
  ADD COLUMN IF NOT EXISTS "credits" integer,
  ADD COLUMN IF NOT EXISTS "durationValue" integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "durationUnit" text NOT NULL DEFAULT 'day';

UPDATE "redeem_codes"
SET "durationValue" = "durationDays", "durationUnit" = 'day'
WHERE "durationValue" = 30 AND "durationDays" <> 30;

ALTER TABLE "redeem_codes" DROP CONSTRAINT IF EXISTS "redeem_codes_kind_valid";
ALTER TABLE "redeem_codes" DROP CONSTRAINT IF EXISTS "redeem_codes_duration_valid";
ALTER TABLE "redeem_codes" DROP CONSTRAINT IF EXISTS "redeem_codes_duration_unit_valid";
ALTER TABLE "redeem_codes" DROP CONSTRAINT IF EXISTS "redeem_codes_payload_valid";
ALTER TABLE "redeem_codes"
  ADD CONSTRAINT "redeem_codes_kind_valid" CHECK ("kind" IN ('group', 'credits')),
  ADD CONSTRAINT "redeem_codes_duration_valid" CHECK ("durationValue" = -1 OR "durationValue" > 0),
  ADD CONSTRAINT "redeem_codes_duration_unit_valid" CHECK ("durationUnit" IN ('day', 'month', 'quarter', 'year')),
  ADD CONSTRAINT "redeem_codes_payload_valid" CHECK (
    ("kind" = 'group' AND "groupId" IS NOT NULL AND "credits" IS NULL)
    OR ("kind" = 'credits' AND "groupId" IS NULL AND "credits" > 0)
  );

CREATE TABLE IF NOT EXISTS "credit_grants" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "credits" integer NOT NULL,
  "remainingCredits" integer NOT NULL,
  "expiresAt" timestamp,
  "source" text NOT NULL DEFAULT 'redeem',
  "redeemCodeId" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "credit_grants_credits_valid" CHECK ("credits" > 0),
  CONSTRAINT "credit_grants_remaining_valid" CHECK ("remainingCredits" >= 0)
);

CREATE INDEX IF NOT EXISTS "credit_grants_user_expiry_idx" ON "credit_grants" ("userId", "expiresAt");

ALTER TABLE "afadian_orders"
  ADD COLUMN IF NOT EXISTS "benefitKey" text,
  ADD COLUMN IF NOT EXISTS "generatedCodes" text NOT NULL DEFAULT '[]';
