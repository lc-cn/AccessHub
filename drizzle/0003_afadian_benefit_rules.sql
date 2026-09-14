CREATE TABLE IF NOT EXISTS "afadian_benefit_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "benefitKey" text NOT NULL UNIQUE,
  "name" text NOT NULL DEFAULT '',
  "kind" text NOT NULL,
  "groupId" text,
  "credits" integer,
  "durationValue" integer NOT NULL DEFAULT 1,
  "durationUnit" text NOT NULL DEFAULT 'month',
  "codesPerItem" integer NOT NULL DEFAULT 1,
  "enabled" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "afadian_benefit_rules_key_valid" CHECK ("benefitKey" ~ '^(plan|sku):[^[:space:]]+$'),
  CONSTRAINT "afadian_benefit_rules_kind_valid" CHECK ("kind" IN ('group', 'credits')),
  CONSTRAINT "afadian_benefit_rules_duration_valid" CHECK ("durationValue" = -1 OR "durationValue" > 0),
  CONSTRAINT "afadian_benefit_rules_duration_unit_valid" CHECK ("durationUnit" IN ('day', 'month', 'quarter', 'year')),
  CONSTRAINT "afadian_benefit_rules_count_valid" CHECK ("codesPerItem" BETWEEN 1 AND 1000),
  CONSTRAINT "afadian_benefit_rules_payload_valid" CHECK (
    ("kind" = 'group' AND "groupId" IS NOT NULL AND "credits" IS NULL)
    OR ("kind" = 'credits' AND "groupId" IS NULL AND "credits" > 0)
  )
);

CREATE INDEX IF NOT EXISTS "afadian_benefit_rules_enabled_idx" ON "afadian_benefit_rules" ("enabled", "benefitKey");
