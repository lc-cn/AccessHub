ALTER TABLE "api_services"
  ADD COLUMN IF NOT EXISTS "transport" text DEFAULT 'http' NOT NULL;

ALTER TABLE "api_services"
  ADD COLUMN IF NOT EXISTS "bindingName" text;

ALTER TABLE "api_services"
  ADD CONSTRAINT "api_services_transport_check"
  CHECK ("transport" IN ('http', 'worker_binding'));

ALTER TABLE "api_services"
  ADD CONSTRAINT "api_services_worker_binding_check"
  CHECK (
    ("transport" = 'http' AND "bindingName" IS NULL)
    OR
    ("transport" = 'worker_binding' AND "bindingName" ~ '^[A-Z_][A-Z0-9_]{0,63}$')
  );
