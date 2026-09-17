BEGIN;

DELETE FROM "account" AS legacy
WHERE legacy."providerId" = 'rbac'
  AND EXISTS (
    SELECT 1
    FROM "account" AS current
    WHERE current."providerId" = 'profilehub'
      AND current."accountId" = legacy."accountId"
  );

UPDATE "account"
SET "providerId" = 'profilehub', "updatedAt" = now()
WHERE "providerId" = 'rbac';

COMMIT;
