import assert from "node:assert/strict";
import test from "node:test";
import { createAdminPasswordVerificationDelivery } from "./admin-password-2fa.js";

test("admin password verification delivery is unconfigured without email delivery", () => {
  const delivery = createAdminPasswordVerificationDelivery({});
  assert.equal(delivery.configured, false);
});

test("admin password verification delivery accepts Resend without SMS credentials", () => {
  const delivery = createAdminPasswordVerificationDelivery({
    RESEND_API_KEY: "re_test",
    PASSWORD_2FA_EMAIL_FROM: "MaktabLink <onboarding@resend.dev>"
  });
  assert.equal(delivery.configured, true);
});

test("admin password verification delivery accepts an email webhook without SMS", () => {
  const delivery = createAdminPasswordVerificationDelivery({
    PASSWORD_2FA_EMAIL_WEBHOOK_URL: "https://example.com/email"
  });
  assert.equal(delivery.configured, true);
});

test("Twilio-only configuration does not satisfy email verification", () => {
  const delivery = createAdminPasswordVerificationDelivery({
    TWILIO_ACCOUNT_SID: "AC123456789",
    TWILIO_AUTH_TOKEN: "test-token",
    TWILIO_FROM_NUMBER: "+15551234567"
  });
  assert.equal(delivery.configured, false);
});
