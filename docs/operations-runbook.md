# AccessHub production runbook

## Release

Production deploys are owned by `.github/workflows/deploy.yml`. Configure the
GitHub `production` environment with:

- secret `CLOUDFLARE_API_TOKEN`, scoped to Workers Scripts and the AccessHub account;
- secret `CLOUDFLARE_ACCOUNT_ID`;
- variable `NEXT_PUBLIC_AFDIAN_URL`.

The workflow runs tests and both TypeScript builds, deploys the Commerce Worker
before the main Worker, and records `git:<sha>` as the Cloudflare version message
and `git-<12-char-sha>` as its tag. Runtime secrets remain managed by Wrangler and
are not copied into GitHub.

Database migrations are deliberately not automatic. Apply and verify them before
merging code that depends on a new schema.

## Health checks after a release

1. `/login` returns `200`.
2. Unauthenticated `/api/dashboard` returns `401`.
3. Sign in and load `/dashboard`, `/services`, and `/account/security`.
4. Invoke one free and one billable endpoint. Only an exact upstream `200` may charge usage.
5. Confirm the deployed versions show the expected `git:<sha>` message.

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
