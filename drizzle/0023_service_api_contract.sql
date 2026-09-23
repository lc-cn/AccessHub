ALTER TABLE "api_services" ADD COLUMN "introduce" text NOT NULL DEFAULT '';
ALTER TABLE "service_apis" ADD COLUMN "accept" text NOT NULL DEFAULT '';
ALTER TABLE "service_apis" ADD COLUMN "requestBodyExample" text NOT NULL DEFAULT '';
