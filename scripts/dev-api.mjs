/**
 * Starts the local MaktabLink API, confirms API/database readiness, then starts
 * ngrok and keeps the ignored Expo API URL synchronized with the active HTTPS
 * tunnel. API + ngrok share one terminal and Ctrl+C stops both.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  mobileEnvFile,
  readMobileApiUrl,
  syncMobileApiUrl
} from "./mobile-api-env.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env");

if (existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch (error) {
    console.error(
      "[dev:api] Failed to load .env:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

const apiPort = Number(process.env.API_PORT?.trim() || "4000");
if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) {
  console.error("[dev:api] API_PORT must be a valid TCP port (1-65535).");
  process.exit(1);
}

const localUrl = "http://127.0.0.1:" + apiPort;
const children = new Map();
let stopping = false;

function available(name) {
  const check = spawnSync(
    process.platform === "win32" ? "where" : "which",
    [name],
    {
      cwd: root,
      encoding: "utf8",
      windowsHide: true
    }
  );
  return check.status === 0;
}

function printLines(label, stream, useError = false) {
  if (!stream) return;
  let buffer = "";

  stream.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    let index = buffer.indexOf("\n");

    while (index >= 0) {
      const line = buffer.slice(0, index).replace(/\r/g, "").trimEnd();
      buffer = buffer.slice(index + 1);

      if (line) {
        const clean = line.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
        if (label === "API" || /error|failed|ERR_NGROK/i.test(clean)) {
          (useError ? console.error : console.log)(
            "[" + label + "] " + clean.slice(0, 2000)
          );
        }
      }

      index = buffer.indexOf("\n");
    }

    if (buffer.length > 16384) buffer = buffer.slice(-8192);
  });
}

function start(label, command, args, env = process.env) {
  let child;

  try {
    child = spawn(command, args, {
      cwd: root,
      // pnpm.cmd and ngrok.cmd on Windows require shell-based command resolution.
      shell: process.platform === "win32",
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      detached: process.platform !== "win32"
    });
  } catch (error) {
    console.error("[dev:api] Could not launch " + label + ": " + String(error));
    return null;
  }

  children.set(label, child);
  printLines(label, child.stdout);
  printLines(label, child.stderr, true);

  child.on("error", (error) => {
    console.error("[dev:api] " + label + " launch failed: " + error.message);
    if (label === "API") {
      void shutdown(1);
    } else {
      console.error("[dev:api] Local API remains available: " + localUrl);
    }
  });

  child.on("exit", (code, signal) => {
    children.delete(label);
    if (stopping) return;

    const info = signal || "exit code " + code;
    if (label === "API") {
      console.error(
        "[dev:api] API stopped (" + info + "); shutting down ngrok."
      );
      void shutdown(1);
    } else {
      console.error(
        "[dev:api] ngrok stopped (" +
          info +
          "). API is still running at " +
          localUrl
      );
    }
  });

  return child;
}

function stopChild(child) {
  if (
    !child.pid ||
    child.exitCode !== null ||
    child.signalCode !== null
  ) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync(
      "taskkill",
      ["/PID", String(child.pid), "/T", "/F"],
      {
        stdio: "ignore",
        windowsHide: true
      }
    );
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      // Process already stopped.
    }
  }
}

async function shutdown(code) {
  if (stopping) return;
  stopping = true;

  for (const child of children.values()) {
    stopChild(child);
  }

  process.exit(code);
}

async function portBusy() {
  return new Promise((resolve, reject) => {
    const tester = net.createServer();

    tester.once("error", (error) => {
      if (error.code === "EADDRINUSE") resolve(true);
      else reject(error);
    });

    tester.listen(apiPort, "127.0.0.1", () => {
      tester.close(() => resolve(false));
    });
  });
}

async function check(endpoint, expected, timeout = 1800) {
  try {
    const response = await fetch(localUrl + endpoint, {
      signal: AbortSignal.timeout(timeout),
      headers: { "Cache-Control": "no-cache" }
    });

    if (!response.ok) return false;

    const value = await response.json();
    return (
      value?.service === "maktablink-api" &&
      value?.status === expected
    );
  } catch {
    return false;
  }
}

async function waitFor(endpoint, expected, limitMs) {
  const deadline = Date.now() + limitMs;

  while (!stopping && children.has("API") && Date.now() < deadline) {
    if (await check(endpoint, expected)) return true;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  return false;
}

async function tunnelUrl() {
  const deadline = Date.now() + 15000;

  while (
    !stopping &&
    children.has("ngrok") &&
    Date.now() < deadline
  ) {
    try {
      const response = await fetch(
        "http://127.0.0.1:4040/api/tunnels",
        { signal: AbortSignal.timeout(1200) }
      );

      if (response.ok) {
        const data = await response.json();
        const found = (
          Array.isArray(data?.tunnels) ? data.tunnels : []
        ).find((tunnel) => {
          const address = String(tunnel?.config?.addr || "");
          const matchesPort = new RegExp(
            "(^|:)" + apiPort + "(/|$)"
          ).test(address);

          return (
            matchesPort &&
            typeof tunnel.public_url === "string" &&
            tunnel.public_url.startsWith("https://")
          );
        });

        if (found) return found.public_url;
      }
    } catch {
      // ngrok may still be starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return null;
}

process.once("SIGINT", () => void shutdown(0));
process.once("SIGTERM", () => void shutdown(0));

async function main() {
  if (!available("pnpm")) {
    console.error("[dev:api] pnpm was not found on PATH.");
    process.exitCode = 1;
    return;
  }

  if (await portBusy()) {
    console.error(
      "[dev:api] Port " +
        apiPort +
        " is already occupied. Stop the old API/process before restarting."
    );
    console.error(
      "[dev:api] Windows diagnosis: Get-NetTCPConnection -LocalPort " +
        apiPort
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    "[dev:api] Launching MaktabLink API first on " + localUrl + " ..."
  );

  const api = start(
    "API",
    "pnpm",
    ["--filter", "@maktablink/api", "dev"]
  );

  if (!api) {
    process.exitCode = 1;
    return;
  }

  if (!(await waitFor("/health", "ok", 30000))) {
    console.error(
      "[dev:api] ERROR: API never returned /health after 30 seconds."
    );
    console.error(
      "[dev:api] Review the [API] errors above. Check .env credentials, API_PORT, dependencies, and migrations."
    );
    console.error(
      "[dev:api] Run 'pnpm --filter @maktablink/api dev' directly to isolate API startup errors."
    );
    await shutdown(1);
    return;
  }

  console.log("[dev:api] API is running: " + localUrl + "/health");

  if (!(await waitFor("/ready", "ready", 12000))) {
    console.error(
      "[dev:api] WARNING: API started but /ready is not ready (database may be unavailable)."
    );
    console.error(
      "[dev:api] ngrok will not expose an unready API. Check DATABASE_URL and pnpm db:migrate."
    );
    console.error(
      "[dev:api] Local API remains running at " + localUrl
    );
    return;
  }

  console.log(
    "[dev:api] Database readiness confirmed: " + localUrl + "/ready"
  );

  if (!available("ngrok")) {
    console.error(
      "[dev:api] ngrok was not found on PATH; the local API is running without a public tunnel."
    );
    console.error(
      "[dev:api] Install/configure ngrok, then restart pnpm dev:api."
    );
    return;
  }

  console.log(
    "[dev:api] Starting ngrok http " +
      apiPort +
      " after API readiness..."
  );

  if (!start("ngrok", "ngrok", ["http", String(apiPort)])) {
    console.error(
      "[dev:api] ngrok failed to launch, but the local API is still running."
    );
    return;
  }

  const url = await tunnelUrl();

  if (!url) {
    console.error(
      "[dev:api] Could not read a matching ngrok HTTPS tunnel from localhost:4040."
    );
    console.error(
      "[dev:api] API is still available locally: " + localUrl
    );
    return;
  }

  console.log("[dev:api] HTTPS tunnel: " + url);

  let tunnelReady = false;
  try {
    const response = await fetch(url + "/health", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(7000)
    });
    const body = await response.json().catch(() => null);
    tunnelReady =
      response.ok &&
      body?.service === "maktablink-api" &&
      body?.status === "ok";
  } catch {
    // Tunnel may be blocked, expired, or still propagating.
  }

  if (!tunnelReady) {
    console.error(
      "[dev:api] Tunnel health check failed: " + url + "/health"
    );
    console.error(
      "[dev:api] Keeping the existing Expo API URL. Check ngrok login/network and restart pnpm dev:api."
    );
  } else if (
    process.env.MAKTABLINK_SYNC_MOBILE_API_URL
      ?.trim()
      .toLowerCase() === "false"
  ) {
    console.log(
      "[dev:api] Expo API URL synchronization disabled (MAKTABLINK_SYNC_MOBILE_API_URL=false)."
    );
    console.log(
      "[dev:api] Set apps/mobile/.env.local EXPO_PUBLIC_API_URL=" + url
    );
  } else {
    const file = mobileEnvFile(root);
    const before = readMobileApiUrl(file);

    try {
      const changed = syncMobileApiUrl(file, url);
      console.log(
        "[dev:api] " +
          (changed ? "Updated" : "Verified") +
          " ignored apps/mobile/.env.local: EXPO_PUBLIC_API_URL=" +
          url
      );

      if (changed) {
        console.log(
          "[dev:api] Previous Expo URL: " + (before ?? "(unset)")
        );
        console.log(
          "[dev:api] IMPORTANT: if Expo is already running, stop and restart it so EXPO_PUBLIC_API_URL is reloaded."
        );
      }
    } catch (error) {
      console.error(
        "[dev:api] Could not sync apps/mobile/.env.local: " +
          (error instanceof Error ? error.message : String(error))
      );
      console.error(
        "[dev:api] Set EXPO_PUBLIC_API_URL=" +
          url +
          " manually and restart Expo."
      );
    }
  }

  console.log(
    "[dev:api] API + ngrok share this terminal. Press Ctrl+C to stop both."
  );
}

main().catch((error) => {
  console.error(
    "[dev:api] Startup failed:",
    error instanceof Error ? error.stack : String(error)
  );
  void shutdown(1);
});
