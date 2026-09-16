CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "name" text NOT NULL,
  "prefix" text NOT NULL,
  "keyHash" text NOT NULL,
  "serviceScopes" jsonb DEFAULT '["*"]'::jsonb NOT NULL,
  "expiresAt" timestamp,
  "lastUsedAt" timestamp,
  "revokedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_hash_unique" ON "api_keys" ("keyHash");
CREATE INDEX IF NOT EXISTS "api_keys_user_created_idx" ON "api_keys" ("userId", "createdAt");
