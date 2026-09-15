---
status: accepted
---

# PSP-independent subscription core

AccessHub owns orders, payments, subscriptions, SKUs and entitlements; Afdian, WeChat Pay and Alipay are replaceable PSP adapters. Provider offers map only to local SKUs, provider events drive the local payment and subscription state machines, and API access is granted through separate plan entitlements so PSP-specific concepts never leak into authorization.

## Consequences

Provider callbacks must first be persisted as idempotent PSP events. A successful payment may create or renew a subscription, but only an active subscription produces a plan entitlement; credits SKUs produce credit grants without creating subscriptions. PSP-specific admin routes are filtered projections of the shared order, payment and event records.
