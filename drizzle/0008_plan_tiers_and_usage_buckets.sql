ALTER TABLE "subscription_plans"
  ADD COLUMN IF NOT EXISTS "rank" integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT "id", CASE
    WHEN "isDefault" THEN 0
    ELSE row_number() OVER (
      PARTITION BY "isDefault"
      ORDER BY CASE lower("name") WHEN 'go' THEN 1 WHEN 'pro' THEN 2 WHEN 'plus' THEN 3 ELSE 4 END, "createdAt"
    ) * 100
  END AS next_rank
  FROM "subscription_plans"
)
UPDATE "subscription_plans" AS plans
SET "rank" = ranked.next_rank
FROM ranked
WHERE plans."id" = ranked."id";

ALTER TABLE "subscription_plans" DROP CONSTRAINT IF EXISTS "subscription_plans_rank_valid";
ALTER TABLE "subscription_plans"
  ADD CONSTRAINT "subscription_plans_rank_valid" CHECK ("rank" >= 0);

ALTER TABLE "api_usage" ADD COLUMN IF NOT EXISTS "planId" text;

UPDATE "api_usage" AS usage
SET "planId" = COALESCE(
  (
    SELECT entitlements."planId"
    FROM "plan_entitlements" AS entitlements
    INNER JOIN "subscription_plans" AS plans ON plans."id" = entitlements."planId"
    WHERE entitlements."userId" = usage."userId"
      AND entitlements."startsAt" <= (usage."usageDate"::date + interval '1 day')
      AND (entitlements."expiresAt" IS NULL OR entitlements."expiresAt" >= usage."usageDate"::date)
    ORDER BY plans."rank" DESC, entitlements."startsAt" DESC
    LIMIT 1
  ),
  (SELECT "id" FROM "subscription_plans" WHERE "isDefault" = true LIMIT 1)
)
WHERE "planId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "api_usage" WHERE "planId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot assign existing api_usage rows: default subscription plan is missing';
  END IF;
END $$;

ALTER TABLE "api_usage" ALTER COLUMN "planId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "api_usage_user_plan_date_idx" ON "api_usage" ("userId", "planId", "usageDate");
