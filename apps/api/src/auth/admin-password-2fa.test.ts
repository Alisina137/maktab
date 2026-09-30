import assert from "node:assert/strict";
import test from "node:test";
import { createAdminPasswordVerificationDelivery } from "./admin-password-2fa.js";

test("admin password verification delivery is unconfigured without two channels", () => {
  const delivery = createAdminPasswordVerificationDelivery({});
  assert.equal(delivery.configured, false);
});

test("admin password verification delivery accepts Resend plus Twilio credentials", () => {
  const delivery = createAdminPasswordVerificationDelivery({
    RESEND_API_KEY: "re_test",
    PASSWORD_2FA_EMAIL_FROM: "MaktabLink <security@example.com>",
    TWILIO_ACCOUNT_SID: "AC123456789",
    TWILIO_AUTH_TOKEN: "test-token",
    TWILIO_FROM_NUMBER: "+15551234567"
  });
  assert.equal(delivery.configured, true);
});

test("admin password verification delivery accepts mixed direct and webhook channels", () => {
  const delivery = createAdminPasswordVerificationDelivery({
    RESEND_API_KEY: "re_test",
    PASSWORD_2FA_EMAIL_FROM: "MaktabLink <security@example.com>",
    PASSWORD_2FA_SMS_WEBHOOK_URL: "https://example.com/sms"
  });
  assert.equal(delivery.configured, true);
});
