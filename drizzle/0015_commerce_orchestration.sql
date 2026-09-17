ALTER TABLE "provider_events"
  ADD COLUMN "attemptCount" integer NOT NULL DEFAULT 0,
  ADD COLUMN "queuedAt" timestamp,
  ADD COLUMN "processingStartedAt" timestamp,
  ADD COLUMN "nextAttemptAt" timestamp,
  ADD COLUMN "workflowInstanceId" text,
  ADD COLUMN "updatedAt" timestamp NOT NULL DEFAULT now();

ALTER TABLE "provider_events" DROP CONSTRAINT IF EXISTS "provider_events_status_valid";
ALTER TABLE "provider_events"
  ADD CONSTRAINT "provider_events_status_valid" CHECK (
    "status" IN ('received', 'queued', 'processing', 'workflow_started', 'processed', 'ignored', 'failed')
  ),
  ADD CONSTRAINT "provider_events_attempt_count_valid" CHECK ("attemptCount" >= 0);

CREATE UNIQUE INDEX "provider_events_workflow_unique"
  ON "provider_events" ("workflowInstanceId")
  WHERE "workflowInstanceId" IS NOT NULL;
CREATE INDEX "provider_events_dispatch_idx"
  ON "provider_events" ("status", "nextAttemptAt", "createdAt");

CREATE TABLE "outbox_events" (
  "id" text PRIMARY KEY NOT NULL,
  "aggregateType" text NOT NULL,
  "aggregateId" text NOT NULL,
  "eventType" text NOT NULL,
  "destination" text NOT NULL DEFAULT 'commerce',
  "deduplicationKey" text NOT NULL,
  "payload" jsonb NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "attemptCount" integer NOT NULL DEFAULT 0,
  "availableAt" timestamp NOT NULL DEFAULT now(),
  "claimedAt" timestamp,
  "claimedBy" text,
  "publishedAt" timestamp,
  "lastError" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "outbox_events_status_valid" CHECK ("status" IN ('pending', 'publishing', 'published', 'failed')),
  CONSTRAINT "outbox_events_attempt_count_valid" CHECK ("attemptCount" >= 0),
  CONSTRAINT "outbox_events_destination_dedupe_unique" UNIQUE ("destination", "deduplicationKey")
);

CREATE INDEX "outbox_events_dispatch_idx"
  ON "outbox_events" ("status", "availableAt", "createdAt");
CREATE INDEX "outbox_events_aggregate_idx"
  ON "outbox_events" ("aggregateType", "aggregateId", "createdAt");

CREATE TABLE "external_effect_attempts" (
  "id" text PRIMARY KEY NOT NULL,
  "providerEventId" text,
  "orderId" text,
  "effectType" text NOT NULL,
  "idempotencyKey" text NOT NULL,
  "target" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'claimed',
  "attemptCount" integer NOT NULL DEFAULT 1,
  "requestPayload" jsonb,
  "responsePayload" jsonb,
  "claimedAt" timestamp NOT NULL DEFAULT now(),
  "completedAt" timestamp,
  "nextAttemptAt" timestamp,
  "lastError" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "external_effect_attempts_status_valid" CHECK ("status" IN ('claimed', 'succeeded', 'failed', 'unknown')),
  CONSTRAINT "external_effect_attempts_attempt_count_valid" CHECK ("attemptCount" > 0),
  CONSTRAINT "external_effect_attempts_idempotency_unique" UNIQUE ("effectType", "idempotencyKey")
);

CREATE INDEX "external_effect_attempts_retry_idx"
  ON "external_effect_attempts" ("status", "nextAttemptAt");
CREATE INDEX "external_effect_attempts_provider_event_idx"
  ON "external_effect_attempts" ("providerEventId");
CREATE INDEX "external_effect_attempts_order_idx"
  ON "external_effect_attempts" ("orderId");
