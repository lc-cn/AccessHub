# Cloudflare Workers deployment

AccessHub runs on Cloudflare Workers through vinext. The migration keeps the existing PostgreSQL database and introduces two upstream transports:

- `http`: call a public HTTPS origin.
- `worker_binding`: call another Worker through a private Service Binding, without public DNS or an Internet round trip.

Keep the Vercel deployment serving production traffic until the Worker preview has passed the checks below.

## 1. Authenticate Wrangler

Run this locally. Complete the browser authorization yourself; do not paste an API token into chat or commit it.

```bash
pnpm exec wrangler login
pnpm exec wrangler whoami
```

## 2. Configure runtime values

Build once so vinext creates the deployment config, then add each sensitive value using Wrangler's interactive prompt. The value is read from your terminal and does not need to be pasted into chat:

```bash
pnpm build:vinext
pnpm exec wrangler secret put DATABASE_URL --config dist/server/wrangler.json
pnpm exec wrangler secret put BETTER_AUTH_SECRET --config dist/server/wrangler.json
pnpm exec wrangler secret put GITHUB_CLIENT_ID --config dist/server/wrangler.json
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET --config dist/server/wrangler.json
pnpm exec wrangler secret put SERVICE_CREDENTIALS_KEY --config dist/server/wrangler.json
pnpm exec wrangler secret put AFDIAN_WEBHOOK_SECRET --config dist/server/wrangler.json
pnpm exec wrangler secret put AFDIAN_USER_ID --config dist/server/wrangler.json
pnpm exec wrangler secret put AFDIAN_ADMIN_TOKEN --config dist/server/wrangler.json
pnpm exec wrangler secret put COMMERCE_INTERNAL_SECRET --config dist/server/wrangler.json
pnpm exec wrangler secret put AFDIAN_OAUTH_CLIENT_ID --config dist/server/wrangler.json
pnpm exec wrangler secret put AFDIAN_OAUTH_CLIENT_SECRET --config dist/server/wrangler.json
pnpm exec wrangler secret put SMTP_HOST --config dist/server/wrangler.json
pnpm exec wrangler secret put SMTP_FROM --config dist/server/wrangler.json
pnpm exec wrangler secret put SMTP_USER --config dist/server/wrangler.json
pnpm exec wrangler secret put SMTP_PASS --config dist/server/wrangler.json
```

Also configure `BETTER_AUTH_URL`, `SMTP_PORT`, `SMTP_SECURE`, and `FRESH_SESSION_MAX_AGE_MINUTES` with the same command and `--config` option. They are not credentials, but using `wrangler secret put` during the preview phase avoids committing environment-specific values. `NEXT_PUBLIC_AFDIAN_URL` is a build-time public value and must be present in the build environment.

Only set optional Afdian, OAuth, or SMTP values for features that are enabled. Never copy `.env.local` into the Worker bundle.

On Cloudflare, a Mailjet SMTP configuration is sent through Mailjet Send API v3.1 over HTTPS instead of opening an SMTP TCP socket. Keep `SMTP_HOST=in-v3.mailjet.com`; `SMTP_USER` and `SMTP_PASS` are used as the Mailjet API Key and Secret Key. Node deployments continue to use the configured SMTP endpoint through Nodemailer.

## 3. Apply the database migration

Apply SQL files through `drizzle/0015_commerce_orchestration.sql` to the existing PostgreSQL database before deploying the asynchronous commerce worker. Existing services are retained as `http` transports, and existing services remain open to all authenticated users until a required permission is selected.

The first preview can use `DATABASE_URL` directly. For production, create a Hyperdrive configuration for the same database in the Cloudflare dashboard, uncomment the `HYPERDRIVE` block in `wrangler.jsonc`, and insert its configuration ID. AccessHub automatically prefers `HYPERDRIVE.connectionString` when the binding exists and falls back to `DATABASE_URL` otherwise.

AccessHub keeps PostgreSQL as its source of truth and uses a cache-disabled Hyperdrive configuration for every authoritative read and write. Authentication, permissions, API keys, billing balances, gateway allowance checks, and administrator settings all require read-after-write consistency. Hyperdrive does not invalidate a cached `SELECT` after a write, so SQL query caching must remain disabled on this binding.

```bash
# Create the strong-consistency database configuration
pnpm exec wrangler hyperdrive create accesshub-db \
  --connection-string="<DATABASE_CONNECTION_STRING>" \
  --caching-disabled

# Or convert an existing configuration
pnpm exec wrangler hyperdrive update <HYPERDRIVE_CONFIG_ID> \
  --caching-disabled

# Verify that `caching.disabled` is true
pnpm exec wrangler hyperdrive get <HYPERDRIVE_CONFIG_ID>
```

Cache-tolerant read models use Workers KV through an explicit cache-aside layer. Create a namespace and bind it separately:

```bash
pnpm exec wrangler kv namespace create ACCESSHUB_CACHE
```

```jsonc
"kv_namespaces": [
  { "binding": "ACCESSHUB_CACHE", "id": "<KV_NAMESPACE_ID>" }
]
```

The initial cached read model is the authenticated user-facing service/API catalog. Permission resolution remains a fresh database read, and the gateway always revalidates permissions and allowance against PostgreSQL. Administrator service and API mutations invalidate the catalog key after the database write. KV failures fall back to PostgreSQL and never block a successful command.

Workers KV is eventually consistent, so cached catalogs may briefly show old descriptive data in another region after invalidation. Do not store sessions, API keys, entitlements, balances, usage, redemption state, webhook idempotency, administrator detail responses, or service credentials in KV. HTTP `Cache-Control` headers do not control Hyperdrive's SQL query cache or Workers KV.

## 4. Configure commerce orchestration

Commerce runs in the separate `accesshub-commerce` Worker. PostgreSQL remains the source of truth; Queue buffers provider events, while Workflows execute order fulfillment and subscription-period reconciliation.

Create the primary queue and its dead-letter queue once:

```bash
pnpm exec wrangler queues create accesshub-commerce-events
pnpm exec wrangler queues create accesshub-commerce-events-dlq
```

These commands use the account's default retention period. On a plan that supports longer retention, update it explicitly with `wrangler queues update <name> --message-retention-period-secs=<seconds>`.

Generate one strong random `COMMERCE_INTERNAL_SECRET` locally, then enter the same value into both interactive prompts. Do not paste it into chat or commit it:

```bash
openssl rand -base64 48
pnpm exec wrangler secret put COMMERCE_INTERNAL_SECRET --config dist/server/wrangler.json
pnpm exec wrangler secret put COMMERCE_INTERNAL_SECRET --config wrangler.commerce.jsonc
```

The main `accesshub` Worker is only a Queue producer. The commerce Worker is the consumer and owns these durable processes:

- `accesshub-order-fulfillment`: normalizes the provider event, creates the local order/payment/codes, then delivers the private message.
- `accesshub-subscription-period`: sleeps until the redeemed subscription period ends, then rechecks the database before expiring it.
- `*/15 * * * *`: republishes pending Outbox records and reconciles any subscription whose expiry job was missed.

Queue and Workflow delivery are at-least-once. Database uniqueness constraints and deterministic Workflow IDs make order creation idempotent. A private-message timeout is recorded as `unknown` and is not blindly retried.

## 5. Declare private upstream Workers

Service Bindings are deployment configuration, so a database row alone cannot create one. Add every private upstream to `wrangler.jsonc`:

```jsonc
"services": [
  { "binding": "IMAGE_API", "service": "image-api" },
  { "binding": "TEXT_API", "service": "text-api", "environment": "production" }
]
```

Then create or edit the corresponding service in `/admin/services`:

- Connection: `Cloudflare Worker Binding`
- Binding name: exactly `IMAGE_API` or `TEXT_API`
- API paths: paths understood by the target Worker, such as `/v1/generate`

Binding names are normalized to uppercase. If an enabled database service references a binding absent from the deployment, the gateway returns `503 upstream_binding_unavailable` and charges zero units. On Vercel or ordinary Node.js, Worker Binding services intentionally return the same error; public HTTP services continue to work.

The target Worker does not need a public route. It must expose a standard `fetch()` handler and be in a Cloudflare account where the binding can be configured.

## 6. Build and deploy a preview

```bash
pnpm test
pnpm typecheck
pnpm build:vinext
pnpm deploy:vinext
pnpm deploy:commerce
```

After changing bindings in `wrangler.jsonc`, rebuild before deploying because vinext generates the final Worker configuration in `dist/server/wrangler.json`.

Validate these paths on the `workers.dev` preview URL:

1. GitHub login, logout, session refresh, and administrator routing.
2. Dashboard, account center, API-key creation, and default API-key retrieval.
3. One free API and one billable API through both HTTP and Worker Binding transports.
4. Upstream timeout/non-200 behavior and the rule that only HTTP 200 consumes usage.
5. Redeem-code fulfillment, Afdian webhook idempotency, Queue/Workflow progress, DLQ behavior, and private-message delivery.
6. Password reset and verification email. Workers blocks outbound TCP port 25; use SMTP 465 or 587 and verify the provider accepts Worker-originated connections.

## 7. Cut over the production domain

After preview acceptance:

1. Attach the production custom domain to the `accesshub` Worker.
2. Set `BETTER_AUTH_URL` to the final canonical HTTPS origin.
3. Update the GitHub and Afdian OAuth callback URLs to that origin.
4. Update the Afdian order webhook URL and run a real low-value fulfillment test.
5. Move DNS traffic, monitor Worker logs and PostgreSQL connections, then retire the Vercel deployment only after a rollback window.

The application still includes Vercel Analytics for migration compatibility. It is not part of the Cloudflare transport path; replace it with Cloudflare Web Analytics after cutover if production analytics are required.
