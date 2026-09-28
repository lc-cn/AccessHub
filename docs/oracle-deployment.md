# Oracle Web deployment

The production Web application runs as a Node.js standalone Next.js process on
the Caddy ingress host. Caddy terminates HTTPS and proxies to a loopback-only
Node port. Cloudflare remains the DNS/CDN provider. The `accesshub-edge` Worker
is a small authenticated bridge for the ProfileHub Service Binding
and the Commerce Queue. `accesshub-commerce` still consumes the queue and runs
Workflows; its `ACCESSHUB` binding points to `accesshub-edge`, which forwards
only the internal commerce command route to the Node origin.

```text
Browser -> Cloudflare DNS/CDN -> Caddy -> 127.0.0.1:3002 -> Next.js + PostgreSQL
                                            |
                                            +-> 10.6.208.136:9981 (QQSign)
                                            +-> accesshub-edge (ProfileHub, Queue)
accesshub-commerce -> accesshub-edge -> HTTPS origin -> Caddy -> Next.js command route
```

## Current two-host layout

- `161.118.242.232` (`10.0.0.230`, ZeroTier `10.6.208.209`): AccessHub on
  `127.0.0.1:3002`, Zhin on `127.0.0.1:8068`, and Caddy HTTPS ingress. The
  Caddy Proxy Manager UI and Beszel monitoring are disabled. Caddy itself is
  required for the public HTTPS sites. The active Caddy JSON is backed up at
  `/etc/caddy/accesshub-before-service-prune.json` and survives a
  `caddy-api.service` restart through Caddy's autosave.
- `213.35.99.41` (`10.0.0.36`, ZeroTier `10.6.208.136`): OneBots on
  `127.0.0.1:6727`, exposed to Caddy over the OCI private network, and QQSign
  on `10.6.208.136:9981`. The host firewall allows port 9981 only from
  `10.6.208.209`. Zhin, Nexterm and Beszel are disabled here; their data is
  retained for rollback.
- AccessHub sets `QQSIGN_PRIVATE_URL=http://10.6.208.136:9981` in its protected
  environment file. The Node adapter maps the existing QQSIGN binding request
  to this private origin, so the service configuration and gateway credentials
  stay unchanged. Removing this environment variable and restarting
  `accesshub-web` restores the `accesshub-edge` QQSIGN path.

The native QQSign process keeps signing sessions in memory. A restart clears
them, so clients that depend on prior registration may need to register again.
The `qsign.zhin.dev` public Worker and its Durable Object data remain in place;
this private routing change does not migrate public Worker clients or state.
Do not delete that Worker as part of a Web rollback.

## Release order

1. Build with Node 22: `pnpm install --frozen-lockfile`,
   `pnpm test`, `pnpm exec tsc --noEmit --incremental false`, then
   `pnpm build:oracle`. Copy `.next/standalone`, `.next/static` and `public` to a
   new version directory on the Oracle host. Do not copy `.env*` into the
   artifact. The Node process needs `server.js`, not the full source tree.
2. Create a `0640` root:accesshub-owned environment file for the Node service. Keep the
   existing `BETTER_AUTH_SECRET`, `SERVICE_CREDENTIALS_KEY`, `DATABASE_URL`,
   OAuth credentials, Afdian settings and SMTP settings. The Vercel environment
   export does not include `PROFILEHUB_CLIENT_ID`, `PROFILEHUB_CLIENT_SECRET`
   or `PROFILEHUB_ISSUER_URL`; obtain these from the current ProfileHub client
   configuration before the public cutover. Rotate the client secret in
   ProfileHub and install that same value on Oracle and the rollback Worker.
   Cloudflare Worker secrets
   cannot be exported. Set
   `BETTER_AUTH_URL=https://l2cl.link`, `EDGE_BRIDGE_URL` to the bridge Worker's
   HTTPS `workers.dev` origin, and `EDGE_BRIDGE_SECRET` to the same newly
   generated random secret installed on `accesshub-edge`.
3. Start the Node service bound to `127.0.0.1:3002` using the example systemd
   unit below. Smoke test `/login` and the unauthenticated `/api/dashboard`
   response locally before creating a public route.
4. Add a proxied `origin-accesshub.l2cl.link` A record and add that hostname to
   the existing Caddy Proxy Manager,
   targeting `127.0.0.1:3002`, with HTTPS. The edge Worker uses this as
   `ORIGIN_URL`; it must not point to the old `accesshub` Worker or loop back to
   itself. Set `COMMERCE_INTERNAL_SECRET` on Node, edge and Commerce Worker to
   the same newly generated value. Deploy `accesshub-edge` and verify unauthorized bridge
   requests are rejected.
5. Deploy `accesshub-commerce` with its `ACCESSHUB` Service Binding pointing to
   `accesshub-edge`. Verify one Queue/Workflow command, QQSIGN request and
   ProfileHub sign-in on the staged Node origin before changing public DNS.
6. Add `l2cl.link` and `www.l2cl.link` to the Caddy proxy route before DNS
   cutover. Obtain and verify their origin certificates first. For the apex,
   DNS-01 validation works while the legacy Worker still serves production;
   install the issued certificate in Caddy and verify it survives a Caddy
   restart. Then remove the legacy Worker custom domains and add proxied A
   records targeting the Oracle host. Keep the old Worker version available
   for rollback until authenticated production smoke checks pass.

The first apex certificate was issued with Certbot's manual DNS-01 challenge
to prevent a cutover outage. After DNS cutover, Caddy obtained its own
certificate through HTTP-01. The temporary manual certificate loader and DNS
challenge record were removed; Caddy now manages renewal with its default
automatic HTTPS behavior. Verify the managed certificate under Caddy's
certificate storage and test HTTPS after a proxy restart.

The bridge accepts only explicitly listed bindings and valid Commerce Queue
messages. Calls from Node require `EDGE_BRIDGE_SECRET`; internal Commerce
commands require `COMMERCE_INTERNAL_SECRET` on both the edge and Node route.
Store these only as Cloudflare Worker secrets and in the Oracle environment
file. Requests to `accesshub-edge` with invalid credentials return 404 or 401.

## Oracle service example

Keep the actual versioned release path and environment file outside this
repository. The environment file must be readable by the service account only.
The Caddy upstream should be loopback; port 3002 does not need an OCI ingress
rule.

```ini
[Unit]
Description=AccessHub Web
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=accesshub
Group=accesshub
WorkingDirectory=/opt/accesshub/current
EnvironmentFile=/etc/accesshub/web.env
Environment=NODE_ENV=production
Environment=HOSTNAME=127.0.0.1
Environment=PORT=3002
Environment=NODE_OPTIONS=--max-old-space-size=384
ExecStart=/opt/accesshub/node/bin/node server.js
Restart=on-failure
RestartSec=5
MemoryMax=600M

[Install]
WantedBy=multi-user.target
```

For a one-vCPU, one-GiB host, build off-host and watch RSS, swap, and p95
latency during the staging smoke test. Do not start multiple Next.js instances
on this host. If the service approaches `MemoryMax`, inspect heap and request
concurrency before increasing the limit; Caddy and monitoring also need memory.

## Rollback

Restore the previous Caddy/DNS route to the legacy `accesshub` Worker, then
restore `accesshub-commerce`'s `ACCESSHUB` binding to `accesshub`. Leave the
Oracle process running only until in-flight requests complete. No database
migration is needed for this transport change.
