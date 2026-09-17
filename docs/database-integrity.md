# Database integrity rollout

Migration `drizzle/0018_relational_integrity.sql` adds foreign keys and checks as
`NOT VALID`. PostgreSQL enforces them for new rows immediately but does not scan
historical rows while the migration is installed.

## 1. Audit historical data

Run these checks against production before validating constraints. Every query
must return zero.

```sql
SELECT count(*) FROM "session" s LEFT JOIN "user" u ON u.id = s."userId" WHERE u.id IS NULL;
SELECT count(*) FROM "account" a LEFT JOIN "user" u ON u.id = a."userId" WHERE u.id IS NULL;
SELECT count(*) FROM "orders" o LEFT JOIN "skus" s ON s.id = o."skuId" WHERE o."skuId" IS NOT NULL AND s.id IS NULL;
SELECT count(*) FROM "payments" p LEFT JOIN "orders" o ON o.id = p."orderId" WHERE o.id IS NULL;
SELECT count(*) FROM "subscriptions" s LEFT JOIN "subscription_plans" p ON p.id = s."planId" WHERE p.id IS NULL;
SELECT count(*) FROM "service_apis" a LEFT JOIN "api_services" s ON s.id = a."serviceId" WHERE s.id IS NULL;
SELECT count(*) FROM "plan_permission_grants" g LEFT JOIN "subscription_plans" p ON p.id = g."planId" WHERE p.id IS NULL;
SELECT count(*) FROM "plan_permission_grants" g LEFT JOIN "permissions" p ON p.id = g."permissionId" WHERE p.id IS NULL;
```

Also check that there is at most one default plan and that plan ranks are unique:

```sql
SELECT count(*) FROM "subscription_plans" WHERE "isDefault" = true;
SELECT "rank", count(*) FROM "subscription_plans" GROUP BY "rank" HAVING count(*) > 1;
```

## 2. Install the migration

Apply `0018_relational_integrity.sql` during a low-traffic window. The two unique
indexes scan `subscription_plans`; this table is expected to remain small.

## 3. Validate constraints

After the audit is clean, list unvalidated constraints:

```sql
SELECT conrelid::regclass AS table_name, conname
FROM pg_constraint
WHERE NOT convalidated
ORDER BY 1, 2;
```

Validate each returned constraint in a maintenance window:

```sql
ALTER TABLE "session" VALIDATE CONSTRAINT "session_user_fk";
```

`VALIDATE CONSTRAINT` uses a lighter lock than creating the constraint and does
not stop ordinary reads and writes for the duration of the historical scan.

