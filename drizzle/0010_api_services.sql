CREATE TABLE IF NOT EXISTS "api_services" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "baseUrl" text NOT NULL,
  "authType" text DEFAULT 'none' NOT NULL,
  "authConfigEncrypted" text,
  "enabled" boolean DEFAULT true NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "service_apis" (
  "id" text PRIMARY KEY NOT NULL,
  "serviceId" text NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "path" text NOT NULL,
  "method" text NOT NULL,
  "parameters" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "usageUnits" integer DEFAULT 1 NOT NULL,
  "timeoutMs" integer DEFAULT 30000 NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "service_apis_service_code_unique" UNIQUE ("serviceId", "code")
);

CREATE INDEX IF NOT EXISTS "service_apis_service_idx" ON "service_apis" ("serviceId");
