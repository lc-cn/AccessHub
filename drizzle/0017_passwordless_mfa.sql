ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "twoFactorEnabled" boolean DEFAULT false NOT NULL;

ALTER TABLE "session"
  ADD COLUMN IF NOT EXISTS "strongAuthAt" timestamp,
  ADD COLUMN IF NOT EXISTS "strongAuthMethod" text;

CREATE TABLE IF NOT EXISTS "passkey" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text,
  "publicKey" text NOT NULL,
  "userId" text NOT NULL,
  "credentialID" text NOT NULL,
  "counter" integer NOT NULL,
  "deviceType" text NOT NULL,
  "backedUp" boolean NOT NULL,
  "transports" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "aaguid" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "passkey_credential_id_unique" ON "passkey" ("credentialID");
CREATE INDEX IF NOT EXISTS "passkey_user_idx" ON "passkey" ("userId");

CREATE TABLE IF NOT EXISTS "twoFactor" (
  "id" text PRIMARY KEY NOT NULL,
  "secret" text NOT NULL,
  "backupCodes" text NOT NULL,
  "userId" text NOT NULL,
  "verified" boolean DEFAULT true NOT NULL,
  "failedVerificationCount" integer DEFAULT 0 NOT NULL,
  "lockedUntil" timestamp
);
CREATE INDEX IF NOT EXISTS "two_factor_secret_idx" ON "twoFactor" ("secret");
CREATE INDEX IF NOT EXISTS "two_factor_user_idx" ON "twoFactor" ("userId");
