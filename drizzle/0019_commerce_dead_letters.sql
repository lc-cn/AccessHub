CREATE TABLE "commerce_dead_letters" (
  "id" text PRIMARY KEY NOT NULL,
  "queueName" text NOT NULL,
  "messageId" text NOT NULL,
  "payload" jsonb NOT NULL,
  "replayable" boolean NOT NULL DEFAULT false,
  "status" text NOT NULL DEFAULT 'pending',
  "deliveryAttempts" integer NOT NULL DEFAULT 0,
  "failedAt" timestamp NOT NULL,
  "replayedAt" timestamp,
  "replayedBy" text,
  "lastError" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "commerce_dead_letters_status_valid" CHECK ("status" IN ('pending', 'replaying', 'replayed', 'dismissed')),
  CONSTRAINT "commerce_dead_letters_attempts_valid" CHECK ("deliveryAttempts" >= 0),
  CONSTRAINT "commerce_dead_letters_message_unique" UNIQUE ("queueName", "messageId")
);

CREATE INDEX "commerce_dead_letters_status_idx"
  ON "commerce_dead_letters" ("status", "failedAt" DESC);

ALTER TABLE "commerce_dead_letters" ADD CONSTRAINT "commerce_dead_letters_replayed_by_fk"
  FOREIGN KEY ("replayedBy") REFERENCES "user"("id") ON DELETE SET NULL NOT VALID;

