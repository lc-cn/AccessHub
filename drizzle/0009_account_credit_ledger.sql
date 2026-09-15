CREATE TABLE IF NOT EXISTS "credit_transactions" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "creditGrantId" text NOT NULL,
  "delta" integer NOT NULL,
  "balanceAfter" integer NOT NULL,
  "reason" text NOT NULL,
  "referenceId" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "credit_transactions_user_created_idx"
  ON "credit_transactions" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "credit_transactions_grant_created_idx"
  ON "credit_transactions" ("creditGrantId", "createdAt");

INSERT INTO "credit_transactions" ("id", "userId", "creditGrantId", "delta", "balanceAfter", "reason", "referenceId", "createdAt")
SELECT 'opening:' || grants."id", grants."userId", grants."id", grants."remainingCredits", grants."remainingCredits", 'opening_balance', grants."redeemCodeId", grants."createdAt"
FROM "credit_grants" AS grants
WHERE NOT EXISTS (
  SELECT 1 FROM "credit_transactions" AS entries WHERE entries."creditGrantId" = grants."id"
);
