-- Add database-level integrity without scanning every historical relationship.
-- NOT VALID constraints protect every new write immediately. Validate them in a
-- maintenance window after running the audit queries in docs/database-integrity.md.
-- The two unique indexes at the end do scan subscription_plans.

ALTER TABLE "session" ADD CONSTRAINT "session_user_fk"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "account" ADD CONSTRAINT "account_user_fk"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_fk"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "twoFactor" ADD CONSTRAINT "two_factor_user_fk"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE NOT VALID;

ALTER TABLE "plan_entitlements" ADD CONSTRAINT "plan_entitlements_user_fk"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "plan_entitlements" ADD CONSTRAINT "plan_entitlements_plan_fk"
  FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") NOT VALID;
ALTER TABLE "plan_entitlements" ADD CONSTRAINT "plan_entitlements_subscription_fk"
  FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL NOT VALID;

ALTER TABLE "redeem_codes" ADD CONSTRAINT "redeem_codes_plan_fk"
  FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") NOT VALID;
ALTER TABLE "redeem_codes" ADD CONSTRAINT "redeem_codes_user_fk"
  FOREIGN KEY ("redeemedBy") REFERENCES "user"("id") ON DELETE SET NULL NOT VALID;
ALTER TABLE "redeem_codes" ADD CONSTRAINT "redeem_codes_order_fk"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL NOT VALID;
ALTER TABLE "redeem_codes" ADD CONSTRAINT "redeem_codes_subscription_fk"
  FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL NOT VALID;

ALTER TABLE "credit_grants" ADD CONSTRAINT "credit_grants_user_fk"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "credit_grants" ADD CONSTRAINT "credit_grants_redeem_code_fk"
  FOREIGN KEY ("redeemCodeId") REFERENCES "redeem_codes"("id") ON DELETE SET NULL NOT VALID;
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_fk"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_grant_fk"
  FOREIGN KEY ("creditGrantId") REFERENCES "credit_grants"("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_user_fk"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_plan_fk"
  FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") NOT VALID;

ALTER TABLE "skus" ADD CONSTRAINT "skus_plan_fk"
  FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") NOT VALID;
ALTER TABLE "provider_offer_mappings" ADD CONSTRAINT "provider_offer_mappings_provider_fk"
  FOREIGN KEY ("providerId") REFERENCES "payment_providers"("id") NOT VALID;
ALTER TABLE "provider_offer_mappings" ADD CONSTRAINT "provider_offer_mappings_sku_fk"
  FOREIGN KEY ("skuId") REFERENCES "skus"("id") NOT VALID;
ALTER TABLE "orders" ADD CONSTRAINT "orders_provider_fk"
  FOREIGN KEY ("providerId") REFERENCES "payment_providers"("id") NOT VALID;
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_fk"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL NOT VALID;
ALTER TABLE "orders" ADD CONSTRAINT "orders_sku_fk"
  FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE SET NULL NOT VALID;
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_fk"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "payments" ADD CONSTRAINT "payments_provider_fk"
  FOREIGN KEY ("providerId") REFERENCES "payment_providers"("id") NOT VALID;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_fk"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL NOT VALID;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_fk"
  FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") NOT VALID;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_sku_fk"
  FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE SET NULL NOT VALID;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_provider_fk"
  FOREIGN KEY ("providerId") REFERENCES "payment_providers"("id") NOT VALID;
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_subscription_fk"
  FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_provider_event_fk"
  FOREIGN KEY ("providerEventId") REFERENCES "provider_events"("id") ON DELETE SET NULL NOT VALID;
ALTER TABLE "provider_events" ADD CONSTRAINT "provider_events_provider_fk"
  FOREIGN KEY ("providerId") REFERENCES "payment_providers"("id") NOT VALID;
ALTER TABLE "external_effect_attempts" ADD CONSTRAINT "external_effect_attempts_provider_event_fk"
  FOREIGN KEY ("providerEventId") REFERENCES "provider_events"("id") ON DELETE SET NULL NOT VALID;
ALTER TABLE "external_effect_attempts" ADD CONSTRAINT "external_effect_attempts_order_fk"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL NOT VALID;
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_fk"
  FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL NOT VALID;

ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_fk"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "api_services" ADD CONSTRAINT "api_services_permission_fk"
  FOREIGN KEY ("requiredPermissionId") REFERENCES "permissions"("id") ON DELETE SET NULL NOT VALID;
ALTER TABLE "service_apis" ADD CONSTRAINT "service_apis_service_fk"
  FOREIGN KEY ("serviceId") REFERENCES "api_services"("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "plan_permission_grants" ADD CONSTRAINT "plan_permission_grants_plan_fk"
  FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "plan_permission_grants" ADD CONSTRAINT "plan_permission_grants_permission_fk"
  FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE NOT VALID;

ALTER TABLE "user" ADD CONSTRAINT "user_role_valid"
  CHECK ("role" IN ('user', 'admin')) NOT VALID;
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_limits_valid"
  CHECK ("rateLimit" >= -1 AND "dailyLimit" >= -1 AND "weeklyLimit" >= -1 AND "monthlyLimit" >= -1) NOT VALID;
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_counts_valid"
  CHECK ("requestCount" >= 0 AND "windowCount" >= 0) NOT VALID;
ALTER TABLE "service_apis" ADD CONSTRAINT "service_apis_usage_units_valid"
  CHECK ("usageUnits" >= 0) NOT VALID;
ALTER TABLE "service_apis" ADD CONSTRAINT "service_apis_timeout_valid"
  CHECK ("timeoutMs" BETWEEN 100 AND 120000) NOT VALID;
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_valid"
  CHECK ("status" IN ('pending', 'paid', 'completed', 'canceled', 'refunded', 'failed')) NOT VALID;
ALTER TABLE "payments" ADD CONSTRAINT "payments_status_valid"
  CHECK ("status" IN ('pending', 'succeeded', 'failed', 'canceled', 'refunded')) NOT VALID;

CREATE UNIQUE INDEX "subscription_plans_single_default_unique"
  ON "subscription_plans" ((1)) WHERE "isDefault" = true;
CREATE UNIQUE INDEX "subscription_plans_rank_unique"
  ON "subscription_plans" ("rank");
