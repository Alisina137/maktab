import assert from "node:assert/strict";
import test from "node:test";
import { readApiRuntimeConfig } from "./runtime-config.js";

const base: Record<string, string> = {
  DATABASE_URL: "postgresql://username:password@example-pooler.neon.tech/app?sslmode=require",
  PLATFORM_PROVISIONING_KEY: "phase9-provisioning-separate-test-secret",
  PASSWORD_2FA_SECRET: "phase9-independent-2fa-test-secret-at-least-32",
  API_METRICS_TOKEN: "phase9-independent-metrics-test-secret-at-least-32",
  WEB_ORIGIN: "https://schools.example.org",
  NODE_ENV: "production"
};
const parse = (changes: Record<string, string | undefined> = {}) =>
  readApiRuntimeConfig({ ...base, ...changes });

test("Phase 9: production startup accepts distinct secured credentials and TLS only", () => {
  const result = parse();
  assert.equal(result.port, 4000);
  assert.equal(result.host, "0.0.0.0");
  assert.equal(result.webOrigin, base.WEB_ORIGIN);
  assert.equal(result.metricsToken, base.API_METRICS_TOKEN);
  assert.notEqual(result.passwordVerificationSecret, result.provisioningKey);
  assert.throws(() => parse({ WEB_ORIGIN: "http://schools.example.org" }), /HTTPS/);
  assert.throws(() => parse({ WEB_ORIGIN: "https://schools.example.org/path" }), /web origin|WEB_ORIGIN/);
  assert.throws(() => parse({ DATABASE_URL: "postgres://u:p@host/db?sslmode=disable" }), /TLS/);
  assert.throws(() => parse({ DATABASE_URL: "postgres://u:p@host/db" }), /TLS/);
  assert.throws(() => parse({ DATABASE_URL: "https://example.com" }), /PostgreSQL/);
  assert.throws(() => parse({ API_PORT: "99999" }), /API_PORT/);
  assert.throws(() => parse({ API_PORT: "0" }), /API_PORT/);
  assert.throws(() => parse({ API_PORT: "not-a-port" }), /API_PORT/);
  assert.throws(() => parse({ PASSWORD_2FA_SECRET: undefined }), /PASSWORD_2FA_SECRET/);
  assert.throws(() => parse({ PASSWORD_2FA_SECRET: base.PLATFORM_PROVISIONING_KEY }), /PASSWORD_2FA_SECRET/);
  assert.throws(() => parse({ API_METRICS_TOKEN: "short" }), /API_METRICS_TOKEN/);
  assert.throws(() => parse({ API_METRICS_TOKEN: base.PLATFORM_PROVISIONING_KEY }), /API_METRICS_TOKEN/);
});

test("Phase 9: development remains compatible with local ngrok/Neon setup", () => {
  const result = readApiRuntimeConfig({
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    PLATFORM_PROVISIONING_KEY: "phase9-local-development-provision-secret",
    NODE_ENV: "development"
  });
  assert.equal(result.port, 4000);
  assert.equal(result.webOrigin, "http://localhost:3000");
  assert.equal(result.passwordVerificationSecret, result.provisioningKey);
  assert.equal(result.metricsToken, undefined);
});
