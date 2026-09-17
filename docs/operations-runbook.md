# AccessHub production runbook

## Release

Production deploys are owned by Cloudflare Workers Builds. Both Workers are
connected to `lc-cn/l2cl`, listen to `master`, and deploy independently after a
push:

- `accesshub` builds from the repository root and requires the public build
  variable `NEXT_PUBLIC_AFDIAN_URL`;
- `accesshub-commerce` uses `/workers/commerce` as its root directory, runs the
  Commerce TypeScript check, and deploys with `pnpm run deploy:commerce` from the
  repository root.

GitHub Actions runs `.github/workflows/ci.yml` only; it verifies tests and types
but does not hold Cloudflare credentials or deploy production. Runtime secrets
remain managed in each Worker's Cloudflare settings.

Database migrations are deliberately not automatic. Apply and verify them before
merging code that depends on a new schema.

## Health checks after a release

1. `/login` returns `200`.
2. Unauthenticated `/api/dashboard` returns `401`.
3. Sign in and load `/dashboard`, `/services`, and `/account/security`.
4. Invoke one free and one billable endpoint. Only an exact upstream `200` may charge usage.
5. Confirm both Cloudflare Workers Builds checks succeeded for the expected commit.

## Alerts

Create Cloudflare notifications or external log alerts for:

- main Worker 5xx rate and p95 latency;
- Commerce Worker exceptions;
- Queue backlog and messages written to `accesshub-commerce-events-dlq`;
- `commerce.queue.retry_scheduled`, `commerce.order_workflow.*`, and
  `commerce.subscription_reconciliation.failed` structured events;
- database connection failures and `upstream_binding_unavailable` responses.

Logs are retained by Workers Observability. Traces sample 5% of main Worker
requests and 10% of Commerce invocations; logs retain 100%. Query strings are
redacted because the legacy Afdian webhook can carry a token in its URL.

## Queue and Workflow incident handling

Do not blindly replay a message until the database has been inspected. Queue and
Workflow delivery is at-least-once; order creation is idempotent, but an external
private-message request can have an unknown outcome.

1. Locate the `provider_events` row by external order number.
2. Inspect its related `orders`, `redeem_codes`, `outbox_events`, and
   `external_effect_attempts` rows.
3. If `deliveryStatus = 'unknown'`, verify the Afdian conversation before taking
   any action. A timeout is not proof that the message failed.
4. Replay only after establishing that the previous external effect did not occur.
5. Record every manual decision in `activity_logs`.

The Commerce Worker consumes its DLQ and persists each message in
`commerce_dead_letters` before acknowledging it. Use `/admin/operations` to inspect
the durable record. Only structurally valid messages are replayable; replay is a
manual, audited action and a record can be replayed only once. If persistence is
unavailable, the DLQ consumer retries instead of acknowledging the message.

## Rollback

Use the Cloudflare dashboard or Wrangler versions commands to restore the previous
known-good Worker version. Roll back the main and Commerce Workers independently.
Database migrations are forward-only: fix data and deploy a corrective migration;
do not drop a newly added integrity constraint during an incident unless it is
proven to reject valid production writes.
