CREATE TABLE "permissions" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "permissions_code_valid" CHECK ("code" ~ '^[a-z][a-z0-9._-]{2,127}$')
);

CREATE TABLE "plan_permission_grants" (
  "id" text PRIMARY KEY NOT NULL,
  "planId" text NOT NULL,
  "permissionId" text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "plan_permission_grants_unique" UNIQUE ("planId", "permissionId")
);

CREATE INDEX "plan_permission_grants_plan_idx" ON "plan_permission_grants" ("planId");
CREATE INDEX "plan_permission_grants_permission_idx" ON "plan_permission_grants" ("permissionId");

ALTER TABLE "api_services" ADD COLUMN "requiredPermissionId" text;
CREATE INDEX "api_services_permission_idx" ON "api_services" ("requiredPermissionId");
