---
status: accepted
---

# Self-service account center with authentication-owned identities

AccessHub exposes user self-service as a dedicated `/account` route group instead of expanding the operational Dashboard. Better Auth remains the source of truth for the User, primary email, login identities, passwords and sessions; AccessHub owns account-facing projections of subscriptions, entitlements, usage, credits and orders. A primary email is verified contact and credential identity, while GitHub, Afdian and email-password are separate login identities attached to the same User.

## Consequences

Authenticated pages use a server-enforced layout so authorization is resolved before account UI renders. Sensitive commands are concentrated behind an account module that applies fresh-session checks, verification, rate limits and safe audit events while delegating authentication mutations to Better Auth. `/account/profile`, `/account/security`, `/account/connections`, `/account/entitlements`, `/account/usage` and `/account/orders` remain separate REST-style pages and read models. Plan usage stays bucketed by plan, and credits gain an append-only transaction ledger so balances and consumption can be explained; historical credit consumption before the ledger is represented only by an opening balance. Account deletion and 2FA require separate decisions because financial-record retention and recovery policy are not yet defined.
