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
pnpm exec wrangler secret put AFDIAN_OAUTH_CLIENT_ID --config dist/server/wrangler.json
pnpm exec wrangler secret put AFDIAN_OAUTH_CLIENT_SECRET --config dist/server/wrangler.json
pnpm exec wrangler secret put SMTP_HOST --config dist/server/wrangler.json
pnpm exec wrangler secret put SMTP_FROM --config dist/server/wrangler.json
pnpm exec wrangler secret put SMTP_USER --config dist/server/wrangler.json
pnpm exec wrangler secret put SMTP_PASS --config dist/server/wrangler.json
```

Also configure `BETTER_AUTH_URL`, `SMTP_PORT`, `SMTP_SECURE`, and `FRESH_SESSION_MAX_AGE_MINUTES` with the same command and `--config` option. They are not credentials, but using `wrangler secret put` during the preview phase avoids committing environment-specific values. `NEXT_PUBLIC_AFDIAN_URL` is a build-time public value and must be present in the build environment.

Only set optional Afdian, OAuth, or SMTP values for features that are enabled. Never copy `.env.local` into the Worker bundle.

## 3. Apply the database migration

Apply SQL files through `drizzle/0014_permissions.sql` to the existing PostgreSQL database before using the administration forms. Existing services are retained as `http` transports, and existing services remain open to all authenticated users until a required permission is selected.

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

## 4. Declare private upstream Workers

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

## 5. Build and deploy a preview

```bash
pnpm test
pnpm build:vinext
pnpm deploy:vinext
```

After changing bindings in `wrangler.jsonc`, rebuild before deploying because vinext generates the final Worker configuration in `dist/server/wrangler.json`.

Validate these paths on the `workers.dev` preview URL:

1. GitHub login, logout, session refresh, and administrator routing.
2. Dashboard, account center, API-key creation, and default API-key retrieval.
3. One free API and one billable API through both HTTP and Worker Binding transports.
4. Upstream timeout/non-200 behavior and the rule that only HTTP 200 consumes usage.
5. Redeem-code fulfillment, Afdian webhook idempotency, and private-message delivery.
6. Password reset and verification email. Workers blocks outbound TCP port 25; use SMTP 465 or 587 and verify the provider accepts Worker-originated connections.

## 6. Cut over the production domain

After preview acceptance:

1. Attach the production custom domain to the `accesshub` Worker.
2. Set `BETTER_AUTH_URL` to the final canonical HTTPS origin.
3. Update the GitHub and Afdian OAuth callback URLs to that origin.
4. Update the Afdian order webhook URL and run a real low-value fulfillment test.
5. Move DNS traffic, monitor Worker logs and PostgreSQL connections, then retire the Vercel deployment only after a rollback window.

The application still includes Vercel Analytics for migration compatibility. It is not part of the Cloudflare transport path; replace it with Cloudflare Web Analytics after cutover if production analytics are required.
