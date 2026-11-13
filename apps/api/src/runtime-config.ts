/** Fail closed on unsafe deployment settings before opening the API port. */
export interface ApiRuntimeConfig {
  databaseUrl: string;
  provisioningKey: string;
  passwordVerificationSecret: string;
  metricsToken?: string;
  host: string;
  port: number;
  webOrigin: string;
}

export function readApiRuntimeConfig(
  env: Record<string, string | undefined>
): ApiRuntimeConfig {
  const production = env.NODE_ENV === "production";
  const databaseUrl = env.DATABASE_URL?.trim();
  const provisioningKey = env.PLATFORM_PROVISIONING_KEY?.trim();
  const passwordSecret = env.PASSWORD_2FA_SECRET?.trim();
  const metricsToken = env.API_METRICS_TOKEN?.trim() || undefined;
  const port = Number(env.API_PORT ?? 4000);
  const host = env.API_HOST?.trim() || "0.0.0.0";
  const webOrigin = env.WEB_ORIGIN?.trim() || "http://localhost:3000";

  if (!databaseUrl) throw new Error("DATABASE_URL must be configured.");
  let connection: URL;
  try { connection = new URL(databaseUrl); } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection string.");
  }
  if (!["postgres:", "postgresql:"].includes(connection.protocol) ||
      !connection.hostname || !connection.pathname.slice(1)) {
    throw new Error("DATABASE_URL must be a complete PostgreSQL connection string.");
  }
  if (!provisioningKey || provisioningKey.length < 24) {
    throw new Error("PLATFORM_PROVISIONING_KEY must contain at least 24 characters.");
  }
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error("API_PORT must be a valid TCP port.");
  }
  if (metricsToken && (metricsToken.length < 32 ||
      metricsToken === provisioningKey || metricsToken === passwordSecret)) {
    throw new Error("API_METRICS_TOKEN must be a separate secret of at least 32 characters.");
  }

  let origin: URL;
  try { origin = new URL(webOrigin); } catch {
    throw new Error("WEB_ORIGIN must be a valid web origin.");
  }
  if (!["http:", "https:"].includes(origin.protocol) ||
      origin.origin !== webOrigin || origin.username || origin.password) {
    throw new Error("WEB_ORIGIN must be an HTTP(S) origin without a path or credentials.");
  }

  if (production) {
    if (!passwordSecret || passwordSecret.length < 32 ||
        passwordSecret === provisioningKey) {
      throw new Error("Production requires a separate PASSWORD_2FA_SECRET of at least 32 characters.");
    }
    if (origin.protocol !== "https:") {
      throw new Error("Production WEB_ORIGIN must use HTTPS.");
    }
    if (!["require", "verify-full", "verify-ca"].includes(
      connection.searchParams.get("sslmode") ?? ""
    )) {
      throw new Error("Production DATABASE_URL must require TLS (sslmode=require or stronger).");
    }
  }

  return {
    databaseUrl,
    provisioningKey,
    passwordVerificationSecret: passwordSecret || provisioningKey,
    metricsToken,
    host, port, webOrigin
  };
}
