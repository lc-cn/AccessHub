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

The application expects `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GITHUB_CLIENT_ID`, and `GITHUB_CLIENT_SECRET`. Set `NEXT_PUBLIC_AFDIAN_URL` to the creator page used by the generic upgrade call to action.

To enable Afdian account linking, also configure `AFDIAN_OAUTH_CLIENT_ID`, `AFDIAN_OAUTH_CLIENT_SECRET`, and the canonical `BETTER_AUTH_URL` (for production, `https://www.l2cl.link`). Register this OAuth callback URL with Afdian:

```text
https://www.l2cl.link/api/auth/callback/afdian
```

## Entitlements

Subscription-plan minute, daily, weekly, and monthly limits accept `-1` for unlimited access. Redeem codes can grant either a subscription plan or an additive credits pack. Credits are consumed one at a time only after a base subscription plan limit is reached; grants that expire sooner are consumed first. Entitlement terms support `day`, `month`, `quarter`, and `year`, while a duration value of `-1` means permanent.

## Afdian automatic fulfillment

Configure Afdian's order webhook to call:

```text
https://your-domain.example/api/afadian/order?token=<AFDIAN_WEBHOOK_SECRET>
```

Set `AFDIAN_WEBHOOK_SECRET` to a long random value and redact the webhook query string from access logs. To send generated codes through Afdian private messages, also configure the creator account's `AFDIAN_USER_ID` and OpenAPI token as `AFDIAN_ADMIN_TOKEN`.

Configure plan and Afdian SKU mappings in the administrator-only **Afdian mappings** page. Each mapping grants a subscription plan or credits pack and sets the number of codes per purchased item. Afdian SKU mappings take precedence over Afdian plan mappings. An enabled `afdian-plan:<plan_id>` mapping also turns the corresponding dashboard plan card into a direct Afdian checkout link.

The webhook accepts paid orders only and uses `out_trade_no` as its idempotency key. Every valid mapped order generates `AFD-...` codes. The code term is taken from `data.order.month`, expressed in months, and its effective period starts only when the user redeems the code. The buyer is notified through `/api/open/send-msg`, using `data.order.user_id` as `recipient`. The administrator-only `/admin/afdian-orders` area shows each order, generated code, message delivery state, and redemption state. Definite message failures may retry on a repeated webhook; unknown delivery outcomes are held for manual reconciliation to avoid duplicate messages.

Apply SQL files in `drizzle/` to the PostgreSQL database before deploying schema-dependent changes.

## Console routes

The console uses path-based routes rather than query-string views:

- `/dashboard`, `/redeem-codes`, and `/api-docs` are regular user pages.
- `/admin/plans`, `/admin/redeem-codes`, `/admin/afdian-mappings`, and `/admin/afdian-orders` are administrator list pages.
- New resources use `/new`; editable resources use `/{id}`.

`/` redirects to `/dashboard`. The old `?view=` navigation is intentionally unsupported.

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.
