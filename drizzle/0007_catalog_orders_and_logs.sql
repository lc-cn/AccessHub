ALTER TABLE "subscriptions" RENAME TO "plan_entitlements";
ALTER TABLE "plan_entitlements" ADD COLUMN "subscriptionId" text;
ALTER TABLE "plan_entitlements" RENAME CONSTRAINT "subscriptions_pkey" TO "plan_entitlements_pkey";

CREATE TABLE "payment_providers" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
INSERT INTO "payment_providers" ("id", "code", "name") VALUES ('psp-afdian', 'afdian', '爱发电');

CREATE TABLE "skus" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "kind" text NOT NULL,
  "planId" text,
  "credits" integer,
  "durationValue" integer NOT NULL DEFAULT 1,
  "durationUnit" text NOT NULL DEFAULT 'month',
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "skus_kind_valid" CHECK ("kind" IN ('plan', 'credits')),
  CONSTRAINT "skus_duration_valid" CHECK ("durationValue" = -1 OR "durationValue" > 0),
  CONSTRAINT "skus_duration_unit_valid" CHECK ("durationUnit" IN ('day', 'month', 'quarter', 'year')),
  CONSTRAINT "skus_payload_valid" CHECK (
    ("kind" = 'plan' AND "planId" IS NOT NULL AND "credits" IS NULL)
    OR ("kind" = 'credits' AND "planId" IS NULL AND "credits" > 0)
  )
);
INSERT INTO "skus" ("id", "code", "name", "kind", "planId", "credits", "durationValue", "durationUnit", "active", "createdAt", "updatedAt")
SELECT 'migrated-' || "id", 'MIG-' || upper(substr(replace("id", '-', ''), 1, 12)),
  CASE WHEN "name" <> '' THEN "name" ELSE "offerKey" END,
  "kind", "planId", "credits", "durationValue", "durationUnit", "enabled", "createdAt", "updatedAt"
FROM "afdian_offer_mappings";

ALTER TABLE "afdian_offer_mappings" RENAME TO "provider_offer_mappings";
ALTER TABLE "provider_offer_mappings" ADD COLUMN "providerId" text NOT NULL DEFAULT 'psp-afdian';
ALTER TABLE "provider_offer_mappings" ADD COLUMN "externalOfferType" text;
ALTER TABLE "provider_offer_mappings" ADD COLUMN "externalOfferId" text;
ALTER TABLE "provider_offer_mappings" ADD COLUMN "skuId" text;
UPDATE "provider_offer_mappings" SET
  "externalOfferType" = CASE WHEN "offerKey" LIKE 'afdian-sku:%' THEN 'sku' ELSE 'plan' END,
  "externalOfferId" = split_part("offerKey", ':', 2),
  "skuId" = 'migrated-' || "id";
ALTER TABLE "provider_offer_mappings" ALTER COLUMN "externalOfferType" SET NOT NULL;
ALTER TABLE "provider_offer_mappings" ALTER COLUMN "externalOfferId" SET NOT NULL;
ALTER TABLE "provider_offer_mappings" ALTER COLUMN "skuId" SET NOT NULL;
ALTER TABLE "provider_offer_mappings" RENAME COLUMN "name" TO "externalName";
ALTER TABLE "provider_offer_mappings" RENAME COLUMN "codesPerItem" TO "unitsPerItem";
ALTER TABLE "provider_offer_mappings"
  DROP CONSTRAINT "afdian_offer_mappings_offer_key_valid",
  DROP CONSTRAINT "afdian_offer_mappings_kind_valid",
  DROP CONSTRAINT "afdian_offer_mappings_duration_valid",
  DROP CONSTRAINT "afdian_offer_mappings_duration_unit_valid",
  DROP CONSTRAINT "afdian_offer_mappings_payload_valid",
  DROP COLUMN "offerKey", DROP COLUMN "kind", DROP COLUMN "planId", DROP COLUMN "credits", DROP COLUMN "durationValue", DROP COLUMN "durationUnit";
ALTER TABLE "provider_offer_mappings" RENAME CONSTRAINT "afdian_offer_mappings_pkey" TO "provider_offer_mappings_pkey";
ALTER TABLE "provider_offer_mappings" RENAME CONSTRAINT "afdian_offer_mappings_count_valid" TO "provider_offer_mappings_units_valid";
DROP INDEX IF EXISTS "afdian_offer_mappings_enabled_idx";
CREATE UNIQUE INDEX "provider_offer_mappings_offer_unique" ON "provider_offer_mappings" ("providerId", "externalOfferType", "externalOfferId");
CREATE INDEX "provider_offer_mappings_enabled_idx" ON "provider_offer_mappings" ("providerId", "enabled");

ALTER TABLE "afadian_orders" RENAME TO "orders";
ALTER TABLE "orders" RENAME COLUMN "outTradeNo" TO "externalOrderId";
ALTER TABLE "orders" RENAME COLUMN "userId" TO "externalCustomerId";
ALTER TABLE "orders" RENAME COLUMN "afdianPlanId" TO "externalOfferId";
ALTER TABLE "orders" RENAME COLUMN "afdianPlanTitle" TO "externalOfferTitle";
ALTER TABLE "orders" RENAME COLUMN "orderMonths" TO "termMonths";
ALTER TABLE "orders" RENAME COLUMN "messageStatus" TO "deliveryStatus";
ALTER TABLE "orders" RENAME COLUMN "messageAttempts" TO "deliveryAttempts";
ALTER TABLE "orders" RENAME COLUMN "messageAttemptedAt" TO "deliveryAttemptedAt";
ALTER TABLE "orders" RENAME COLUMN "messageSentAt" TO "deliveredAt";
ALTER TABLE "orders" RENAME COLUMN "messageLastError" TO "deliveryLastError";
ALTER TABLE "orders" RENAME COLUMN "payload" TO "rawPayload";
ALTER TABLE "orders" ADD COLUMN "providerId" text NOT NULL DEFAULT 'psp-afdian';
ALTER TABLE "orders" ADD COLUMN "userId" text;
ALTER TABLE "orders" ADD COLUMN "skuId" text;
ALTER TABLE "orders" ADD COLUMN "status" text NOT NULL DEFAULT 'paid';
ALTER TABLE "orders" ADD COLUMN "currency" text NOT NULL DEFAULT 'CNY';
ALTER TABLE "orders" ADD COLUMN "updatedAt" timestamp NOT NULL DEFAULT now();
UPDATE "orders" AS o SET "skuId" = m."skuId" FROM "provider_offer_mappings" AS m
WHERE m."providerId" = 'psp-afdian'
  AND m."externalOfferType" = CASE WHEN o."offerKey" LIKE 'afdian-sku:%' THEN 'sku' ELSE 'plan' END
  AND m."externalOfferId" = split_part(o."offerKey", ':', 2);

CREATE TABLE "provider_events" (
  "id" text PRIMARY KEY NOT NULL, "providerId" text NOT NULL, "externalEventId" text NOT NULL,
  "type" text NOT NULL, "status" text NOT NULL DEFAULT 'received', "error" text,
  "rawPayload" text NOT NULL, "processedAt" timestamp, "createdAt" timestamp NOT NULL DEFAULT now()
);
INSERT INTO "provider_events" ("id", "providerId", "externalEventId", "type", "status", "rawPayload", "processedAt", "createdAt")
SELECT 'migrated-' || "id", 'psp-afdian', "externalOrderId", 'order.paid', 'processed', "rawPayload", "createdAt", "createdAt" FROM "orders";
CREATE UNIQUE INDEX "provider_events_external_unique" ON "provider_events" ("providerId", "externalEventId", "type");
CREATE INDEX "provider_events_created_idx" ON "provider_events" ("createdAt" DESC);

ALTER TABLE "orders" DROP COLUMN "offerKey";
ALTER TABLE "orders" DROP COLUMN "generatedCodes";
ALTER TABLE "orders" DROP COLUMN "rawPayload";
ALTER TABLE "orders" RENAME CONSTRAINT "afadian_orders_pkey" TO "orders_pkey";
ALTER TABLE "orders" DROP CONSTRAINT "afadian_orders_outTradeNo_key";
ALTER TABLE "orders" RENAME CONSTRAINT "afadian_orders_months_valid" TO "orders_term_months_valid";
ALTER TABLE "orders" RENAME CONSTRAINT "afadian_orders_message_status_valid" TO "orders_delivery_status_valid";
ALTER INDEX "afadian_orders_created_idx" RENAME TO "orders_created_idx";
CREATE UNIQUE INDEX "orders_provider_external_unique" ON "orders" ("providerId", "externalOrderId") WHERE "externalOrderId" IS NOT NULL;

CREATE TABLE "payments" (
  "id" text PRIMARY KEY NOT NULL, "orderId" text NOT NULL, "providerId" text,
  "externalPaymentId" text, "status" text NOT NULL, "amount" text NOT NULL DEFAULT '',
  "currency" text NOT NULL DEFAULT 'CNY', "paidAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now()
);
INSERT INTO "payments" ("id", "orderId", "providerId", "externalPaymentId", "status", "amount", "paidAt", "createdAt", "updatedAt")
SELECT 'payment-' || "id", "id", "providerId", "externalOrderId", 'succeeded', "amount", "createdAt", "createdAt", "createdAt" FROM "orders";
CREATE INDEX "payments_order_idx" ON "payments" ("orderId");

CREATE TABLE "subscriptions" (
  "id" text PRIMARY KEY NOT NULL, "userId" text, "planId" text NOT NULL, "skuId" text,
  "providerId" text, "providerSubscriptionId" text, "status" text NOT NULL DEFAULT 'pending_activation',
  "currentPeriodStart" timestamp, "currentPeriodEnd" timestamp,
  "cancelAtPeriodEnd" boolean NOT NULL DEFAULT false, "canceledAt" timestamp, "endedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "subscriptions_status_valid" CHECK ("status" IN ('pending_activation', 'trialing', 'active', 'past_due', 'paused', 'canceled', 'expired'))
);
INSERT INTO "subscriptions" ("id", "userId", "planId", "skuId", "providerId", "status", "currentPeriodStart", "currentPeriodEnd", "createdAt", "updatedAt")
SELECT 'subscription-' || rc."id", rc."redeemedBy", s."planId", o."skuId", o."providerId",
  CASE WHEN rc."redeemedAt" IS NULL THEN 'pending_activation' ELSE 'active' END,
  rc."redeemedAt", CASE WHEN rc."redeemedAt" IS NULL THEN NULL ELSE rc."redeemedAt" + make_interval(months => o."termMonths") END,
  o."createdAt", coalesce(rc."redeemedAt", o."createdAt")
FROM "orders" o JOIN "skus" s ON s."id" = o."skuId"
JOIN "redeem_codes" rc ON rc."afadianOrderId" = o."id"
WHERE s."kind" = 'plan';

CREATE TABLE "subscription_events" (
  "id" text PRIMARY KEY NOT NULL, "subscriptionId" text NOT NULL, "type" text NOT NULL,
  "fromStatus" text, "toStatus" text NOT NULL, "providerEventId" text, "detail" text NOT NULL DEFAULT '',
  "createdAt" timestamp NOT NULL DEFAULT now()
);
INSERT INTO "subscription_events" ("id", "subscriptionId", "type", "toStatus", "detail", "createdAt")
SELECT 'event-' || "id", "id", 'migrated', "status", 'Migrated from Afdian fulfillment', "createdAt" FROM "subscriptions";
CREATE INDEX "subscription_events_subscription_idx" ON "subscription_events" ("subscriptionId", "createdAt" DESC);

ALTER TABLE "redeem_codes" RENAME COLUMN "afadianOrderId" TO "orderId";
ALTER TABLE "redeem_codes" ADD COLUMN "subscriptionId" text;
UPDATE "redeem_codes" SET "subscriptionId" = 'subscription-' || "id" WHERE "orderId" IS NOT NULL AND "kind" = 'plan';
ALTER INDEX "redeem_codes_afadian_order_idx" RENAME TO "redeem_codes_order_idx";
UPDATE "plan_entitlements" pe SET "subscriptionId" = rc."subscriptionId" FROM "redeem_codes" rc WHERE rc."redeemedBy" = pe."userId" AND rc."planId" = pe."planId" AND rc."redeemedAt" = pe."startsAt";

CREATE TABLE "activity_logs" (
  "id" text PRIMARY KEY NOT NULL, "actorId" text, "action" text NOT NULL,
  "resourceType" text NOT NULL, "resourceId" text, "detail" text NOT NULL DEFAULT '',
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX "activity_logs_created_idx" ON "activity_logs" ("createdAt" DESC);
