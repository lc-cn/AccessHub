CREATE UNIQUE INDEX IF NOT EXISTS "account_provider_account_unique"
ON "account" ("providerId", "accountId");
