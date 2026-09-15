# l2cl

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_w3KXlM81N1PVA0RcA0xkmtfdrd8k)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The application expects `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GITHUB_CLIENT_ID`, and `GITHUB_CLIENT_SECRET`. Set `NEXT_PUBLIC_AFDIAN_URL` to the creator page used by the upgrade call to action.

To enable Afdian account linking, also configure `AFDIAN_OAUTH_CLIENT_ID`, `AFDIAN_OAUTH_CLIENT_SECRET`, and the canonical `BETTER_AUTH_URL` (for production, `https://www.l2cl.link`). Register this OAuth callback URL with Afdian:

```text
https://www.l2cl.link/api/auth/callback/afdian
```

## Entitlements

User-group minute, daily, weekly, and monthly limits accept `-1` for unlimited access. Redeem codes can grant either a user group or an additive credits pack. Credits are consumed one at a time only after a base group limit is reached; grants that expire sooner are consumed first. Entitlement terms support `day`, `month`, `quarter`, and `year`, while a duration value of `-1` means permanent.

## Afdian automatic fulfillment

Configure Afdian's order webhook to call:

```text
https://your-domain.example/api/afadian/order?token=<AFDIAN_WEBHOOK_SECRET>
```

Set `AFDIAN_WEBHOOK_SECRET` to a long random value and redact the webhook query string from access logs. Configure plan and SKU mappings in the administrator-only **Afdian** page. Each mapping can grant a user group or credits pack, select its term, set the number of codes per purchased item, and be disabled without deletion. SKU mappings take precedence over plan mappings.

The webhook accepts paid orders only and uses `out_trade_no` as its idempotency key. A GitHub-authenticated user who starts purchasing through `/api/afadian/purchase` is asked to link Afdian first. The OAuth identity is stored as a Better Auth `afdian` account provider, so webhook orders with the same Afdian `user_id` can grant the mapped group or credits directly. Orders from an unlinked Afdian account keep the original behavior and generate `AFD-...` codes as a fallback. Set `NEXT_PUBLIC_AFDIAN_URL` to the public creator page shown in the upgrade action.

Apply SQL files in `drizzle/` to the PostgreSQL database before deploying schema-dependent changes.

## Console routes

The console uses path-based routes rather than query-string views:

- `/dashboard`, `/redeem-codes`, and `/api-docs` are regular user pages.
- `/admin/groups`, `/admin/redeem-codes`, and `/admin/afdian-mappings` are administrator list pages.
- New resources use `/new`; editable resources use `/{id}`.

`/` redirects to `/dashboard`. The old `?view=` navigation is intentionally unsupported.

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.
