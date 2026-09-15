ALTER TABLE "groups" RENAME TO "subscription_plans";
ALTER TABLE "group_memberships" RENAME TO "subscriptions";

ALTER TABLE "subscriptions" RENAME COLUMN "groupId" TO "planId";
ALTER TABLE "redeem_codes" RENAME COLUMN "groupId" TO "planId";
ALTER TABLE "afadian_benefit_rules" RENAME TO "afdian_offer_mappings";
ALTER TABLE "afdian_offer_mappings" RENAME COLUMN "groupId" TO "planId";
ALTER TABLE "afdian_offer_mappings" RENAME COLUMN "benefitKey" TO "offerKey";
ALTER TABLE "afadian_orders" RENAME COLUMN "planId" TO "afdianPlanId";
ALTER TABLE "afadian_orders" RENAME COLUMN "planTitle" TO "afdianPlanTitle";
ALTER TABLE "afadian_orders" RENAME COLUMN "benefitKey" TO "offerKey";

ALTER TABLE "redeem_codes"
  DROP CONSTRAINT IF EXISTS "redeem_codes_kind_valid",
  DROP CONSTRAINT IF EXISTS "redeem_codes_payload_valid";
ALTER TABLE "afdian_offer_mappings"
  DROP CONSTRAINT IF EXISTS "afadian_benefit_rules_key_valid",
  DROP CONSTRAINT IF EXISTS "afadian_benefit_rules_kind_valid",
  DROP CONSTRAINT IF EXISTS "afadian_benefit_rules_payload_valid";

UPDATE "redeem_codes" SET "kind" = 'plan' WHERE "kind" = 'group';
UPDATE "afdian_offer_mappings" SET "kind" = 'plan' WHERE "kind" = 'group';
UPDATE "afdian_offer_mappings"
SET "offerKey" = CASE
  WHEN "offerKey" LIKE 'plan:%' THEN 'afdian-plan:' || substring("offerKey" FROM 6)
  WHEN "offerKey" LIKE 'sku:%' THEN 'afdian-sku:' || substring("offerKey" FROM 5)
  ELSE "offerKey"
END;

ALTER TABLE "redeem_codes"
  ADD CONSTRAINT "redeem_codes_kind_valid" CHECK ("kind" IN ('plan', 'credits')),
  ADD CONSTRAINT "redeem_codes_payload_valid" CHECK (
    ("kind" = 'plan' AND "planId" IS NOT NULL AND "credits" IS NULL)
    OR ("kind" = 'credits' AND "planId" IS NULL AND "credits" > 0)
  );
ALTER TABLE "afdian_offer_mappings"
  ADD CONSTRAINT "afdian_offer_mappings_offer_key_valid" CHECK ("offerKey" ~ '^(afdian-plan|afdian-sku):[^[:space:]]+$'),
  ADD CONSTRAINT "afdian_offer_mappings_kind_valid" CHECK ("kind" IN ('plan', 'credits')),
  ADD CONSTRAINT "afdian_offer_mappings_payload_valid" CHECK (
    ("kind" = 'plan' AND "planId" IS NOT NULL AND "credits" IS NULL)
    OR ("kind" = 'credits' AND "planId" IS NULL AND "credits" > 0)
  );

ALTER INDEX IF EXISTS "afadian_benefit_rules_enabled_idx" RENAME TO "afdian_offer_mappings_enabled_idx";

ALTER TABLE "subscription_plans" RENAME CONSTRAINT "groups_pkey" TO "subscription_plans_pkey";
ALTER TABLE "subscription_plans" RENAME CONSTRAINT "groups_name_key" TO "subscription_plans_name_key";
ALTER TABLE "subscription_plans" RENAME CONSTRAINT "groups_rate_limit_valid" TO "subscription_plans_rate_limit_valid";
ALTER TABLE "subscription_plans" RENAME CONSTRAINT "groups_daily_limit_valid" TO "subscription_plans_daily_limit_valid";
ALTER TABLE "subscription_plans" RENAME CONSTRAINT "groups_weekly_limit_valid" TO "subscription_plans_weekly_limit_valid";
ALTER TABLE "subscription_plans" RENAME CONSTRAINT "groups_monthly_limit_valid" TO "subscription_plans_monthly_limit_valid";
ALTER TABLE "subscriptions" RENAME CONSTRAINT "group_memberships_pkey" TO "subscriptions_pkey";
ALTER TABLE "afdian_offer_mappings" RENAME CONSTRAINT "afadian_benefit_rules_pkey" TO "afdian_offer_mappings_pkey";
ALTER TABLE "afdian_offer_mappings" RENAME CONSTRAINT "afadian_benefit_rules_benefitKey_key" TO "afdian_offer_mappings_offerKey_key";
ALTER TABLE "afdian_offer_mappings" RENAME CONSTRAINT "afadian_benefit_rules_duration_valid" TO "afdian_offer_mappings_duration_valid";
ALTER TABLE "afdian_offer_mappings" RENAME CONSTRAINT "afadian_benefit_rules_duration_unit_valid" TO "afdian_offer_mappings_duration_unit_valid";
ALTER TABLE "afdian_offer_mappings" RENAME CONSTRAINT "afadian_benefit_rules_count_valid" TO "afdian_offer_mappings_count_valid";
