# Account center implementation delegation

Use these prompts in order. Every agent starts by reading `docs/adr/0002-self-service-account-center.md`, `CONTEXT.md`, `lib/auth.ts`, `lib/db/schema.ts` and the files in its ownership list. Preserve unrelated work and the existing uncommitted `tsconfig.tsbuildinfo`. Use `apply_patch` for edits. Do not deploy or run production migrations; the integration agent owns release.

## Execution map

1. Run Foundation alone.
2. After Foundation is merged, run Account UI, Security, and Entitlements in parallel.
3. Run Integration after all three work packages are merged.

## Agent: Foundation

```text
Implement the account-center foundation in /Users/liuchunlang/l2cl.

Read and follow docs/adr/0002-self-service-account-center.md and CONTEXT.md. Inspect the installed Better Auth 1.7.4 types before relying on an auth method. Use current official Better Auth documentation for library-specific behavior.

Own only:
- lib/auth.ts
- lib/auth-client.ts
- lib/account/**
- lib/email/**
- app/account/layout.tsx
- app/account/loading.tsx
- new migrations required solely by shared account infrastructure
- focused tests for these modules

Deliver:
1. A server-enforced authenticated layout that redirects unauthenticated users before account content renders, without changing public webhook/API behavior.
2. A small account-module interface for fresh-session enforcement, safe account errors, and security-event recording. Keep Better Auth implementation details behind this seam where server-only behavior is required.
3. Transactional-email integration points for verification, email change and password reset. Configuration must fail clearly when email delivery is unavailable; never log tokens or secrets. Do not select or provision a vendor unless configuration already identifies one.
4. Better Auth configuration for email/password, verified-email change, password reset and session revocation, consistent with OAuth-only users that may not yet have a credential identity.
5. No account UI beyond a minimal authenticated-layout fixture.

Completion criteria:
- Existing GitHub and Afdian login/linking behavior remains covered.
- Public webhook routes remain outside proxy authentication.
- Fresh versus stale session behavior has focused tests.
- Missing email configuration has a deterministic, user-safe result.
- npm test, npx tsc --noEmit, and npx next build --webpack pass.
- Hand off the exact environment variable names the owner must configure, without requesting secret values.
```

## Agent: Account UI and profile

```text
Implement the account-center shell and profile experience in /Users/liuchunlang/l2cl after the Foundation work is merged.

Read docs/adr/0002-self-service-account-center.md and reuse the authenticated layout and account-module interfaces already present. Preserve the existing AccessHub visual language and REST-style page URLs.

Own only:
- app/account/page.tsx
- app/account/profile/**
- components/account/account-shell.tsx
- components/account/account-overview.tsx
- components/account/profile.tsx
- components/access-hub/workspace-page.tsx for the single navigation entry and clickable user card
- account UI types local to the owned components
- focused component/pure-function tests

Deliver:
1. `/account` overview with user identity, primary-email status, current plan, default fallback, credits, linked-login count and recent safe activity.
2. `/account/profile` for name and avatar editing; UID, role and registration time are read-only.
3. A compact account sub-navigation linking Profile, Security, Connections, Entitlements, Usage and Orders. It may link to pages owned by other agents before they land.
4. Skeleton, empty, error, success, dirty-form and responsive states.
5. Dashboard remains an operational summary and links into account details instead of duplicating full management interfaces.

Completion criteria:
- Direct navigation and refresh work for every owned URL.
- No administrator navigation flashes for normal users.
- Keyboard focus, labels and mobile overflow are usable.
- No token, password, raw provider identifier or private audit detail reaches the UI.
- npm test, npx tsc --noEmit, and npx next build --webpack pass.
```

## Agent: Security and login identities

```text
Implement personal security and login-identity management in /Users/liuchunlang/l2cl after the Foundation work is merged.

Read docs/adr/0002-self-service-account-center.md. Treat primary email and login identities as different concepts. Use Better Auth account record id, not the provider-side accountId, for account-specific operations.

Own only:
- app/account/security/**
- app/account/connections/**
- app/api/account/email-change-requests/**
- app/api/account/email-verification-requests/**
- app/api/account/password/**
- app/api/account/password-reset-requests/**
- app/api/account/identities/**
- app/api/account/sessions/**
- components/account/security/**
- components/account/connections/**
- app/login/page.tsx
- focused tests for these flows

Deliver:
1. Primary-email display, verification resend and verified email-change flow. The new address becomes primary only after proof of mailbox control; require current-email confirmation where available.
2. Distinct Create password and Change password states. Creating a credential identity requires a verified primary email and fresh session. Changing a password verifies the current password and revokes other sessions by default.
3. Email/password sign-in and password-reset entry points on the login page without regressing GitHub or Afdian login.
4. Session listing, single-session revocation and revoke-other-sessions.
5. GitHub/Afdian/email-password identity listing and safe unlinking. At least one usable login method must remain. Afdian unlink warns that future purchases will not auto-bind while historical orders and entitlements remain.
6. Per-user/per-IP rate limiting for sensitive requests and safe activity records that contain no password, token or full verification URL.

Completion criteria:
- OAuth-only, credential-only and mixed-identity users are tested.
- Duplicate email, expired verification, stale session, last-identity unlink and provider-owned-by-another-user paths are tested.
- Access/refresh tokens never appear in responses or logs.
- Better Auth methods match the installed 1.7.4 interface.
- npm test, npx tsc --noEmit, and npx next build --webpack pass.
```

## Agent: Entitlements, usage, credits and orders

```text
Implement account-facing commercial and usage read models in /Users/liuchunlang/l2cl after the Foundation work is merged.

Read docs/adr/0002-self-service-account-center.md, docs/adr/0001-psp-independent-subscription-core.md and CONTEXT.md. Preserve the existing allowance order: current plan, default plan, credits, then rejection.

Own only:
- app/account/entitlements/**
- app/account/usage/**
- app/account/orders/**
- app/api/account/entitlements/**
- app/api/account/usage/**
- app/api/account/orders/**
- components/account/entitlements/**
- components/account/usage/**
- components/account/orders/**
- lib/credit-ledger/**
- app/api/gateway/route.ts only for recording credit-ledger transactions
- lib/db/schema.ts additions for the credit ledger and usage uniqueness
- one new sequential migration for those additions
- focused tests for read models and ledger invariants

Deliver:
1. `/account/entitlements` showing current plan, Included default fallback, active/expired entitlements, subscription source and expiry, and credit grants by source and expiry.
2. `/account/usage` with 7/30/90-day and custom-range daily series, separated into current-plan, default-fallback and credits consumption. Reset times use the existing UTC period rules.
3. An append-only credit transaction ledger with delta, balanceAfter, reason, request/source reference and timestamp. Migration records existing remaining balances as opening-balance entries without inventing historical consumption.
4. Gateway credit consumption writes the balance update and ledger entry atomically under the existing user transaction lock. Idempotent/retried requests must not create unexplained duplicate debits.
5. `/account/orders` exposes only the signed-in user's unified orders, payments, redemption delivery and resulting entitlement status; PSP-specific payloads stay hidden.

Completion criteria:
- Ledger sums reconcile with every credit grant balance.
- Current/default usage buckets never merge.
- Date-range boundaries and empty periods are tested.
- Users cannot read another user's order, usage or entitlement by changing a URL/query value.
- Migration is reversible in a transaction rehearsal and preserves existing balances.
- npm test, npx tsc --noEmit, and npx next build --webpack pass.
```

## Agent: Integration and release acceptance

```text
Integrate and verify the complete account center in /Users/liuchunlang/l2cl after Foundation, Account UI, Security, and Entitlements are merged.

Read both ADRs and CONTEXT.md. You own conflict resolution and may edit any account-center file, but preserve unrelated user changes and keep tsconfig.tsbuildinfo uncommitted.

Tasks:
1. Reconcile route ownership, shared types, navigation, loading states and error envelopes. Remove duplicate read queries and shallow pass-through modules.
2. Confirm server-enforced authentication for every `/account` page and session validation inside every `/api/account` handler. Confirm public webhooks remain public.
3. Run the Better Auth schema generator in inspection mode, compare it with lib/db/schema.ts, and account for every difference before changing schema.
4. Run focused tests, npm test, npx tsc --noEmit, npx next build --webpack and git diff --check.
5. Transaction-rehearse every new migration against the configured database and roll it back. Report row counts and invariant checks without printing secrets.
6. Browser-test production-shaped flows at desktop and mobile widths: direct-route auth, profile edit, email states, password states, linked identities, session revocation, plan fallback display, usage filters, credit ledger and user-owned orders.
7. Produce a release report separating local verification, preview deployment, production migration and production deployment. Stop before production writes unless the user explicitly authorizes release.

Acceptance gates:
- OAuth-only users can safely create a password only after email verification and fresh authentication.
- A user can never remove the final usable login method.
- Email changes do not move subscriptions, orders or entitlements between Users.
- Current-plan exhaustion falls back to independently counted default-plan allowance before credits.
- Every credit debit is explainable by an immutable ledger entry.
- Account APIs never expose authentication tokens, password hashes, webhook payloads or another user's data.
- No identity/admin flash occurs during route transitions.
```
