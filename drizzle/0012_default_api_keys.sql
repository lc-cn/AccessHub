ALTER TABLE "api_keys"
  ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'custom' NOT NULL,
  ADD COLUMN IF NOT EXISTS "secretEncrypted" text;

CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_user_default_unique"
  ON "api_keys" ("userId")
  WHERE "kind" = 'default' AND "revokedAt" IS NULL;
