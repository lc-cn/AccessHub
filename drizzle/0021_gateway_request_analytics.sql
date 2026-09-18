CREATE TABLE IF NOT EXISTS "gateway_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "apiKeyId" text,
  "serviceId" text NOT NULL,
  "apiId" text NOT NULL,
  "requestMethod" text NOT NULL,
  "outcome" text NOT NULL,
  "responseStatus" integer NOT NULL,
  "upstreamStatus" integer,
  "configuredUsageUnits" integer DEFAULT 0 NOT NULL,
  "chargedUsageUnits" integer DEFAULT 0 NOT NULL,
  "allowanceSource" text,
  "durationMs" integer DEFAULT 0 NOT NULL,
  "errorCode" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "gateway_requests_created_idx" ON "gateway_requests" USING btree ("createdAt");
CREATE INDEX IF NOT EXISTS "gateway_requests_user_created_idx" ON "gateway_requests" USING btree ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "gateway_requests_service_created_idx" ON "gateway_requests" USING btree ("serviceId", "createdAt");
CREATE INDEX IF NOT EXISTS "gateway_requests_api_created_idx" ON "gateway_requests" USING btree ("apiId", "createdAt");
CREATE INDEX IF NOT EXISTS "gateway_requests_outcome_created_idx" ON "gateway_requests" USING btree ("outcome", "createdAt");
