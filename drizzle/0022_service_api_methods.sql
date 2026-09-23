ALTER TABLE "service_apis" ADD COLUMN "methods" text[] NOT NULL DEFAULT ARRAY['GET']::text[];
UPDATE "service_apis" SET "methods" = ARRAY["method"];
ALTER TABLE "service_apis" ADD CONSTRAINT "service_apis_methods_nonempty" CHECK (cardinality("methods") BETWEEN 1 AND 5 AND "methods" <@ ARRAY['GET', 'POST', 'PUT', 'PATCH', 'DELETE']::text[]);
