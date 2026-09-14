ALTER TABLE "groups"
  ADD COLUMN IF NOT EXISTS "weeklyLimit" integer,
  ADD COLUMN IF NOT EXISTS "monthlyLimit" integer;

DO $$ BEGIN
  ALTER TABLE "groups" ADD CONSTRAINT "groups_weekly_limit_positive" CHECK ("weeklyLimit" IS NULL OR "weeklyLimit" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "groups" ADD CONSTRAINT "groups_monthly_limit_positive" CHECK ("monthlyLimit" IS NULL OR "monthlyLimit" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
