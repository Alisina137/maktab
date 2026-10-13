// Verify actual process supervision without a real API, tunnel, or database.
// POSIX fake commands run only on the Linux CI runner.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";

const base = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const launcher = path.join(base, "scripts", "dev-api.mjs");

execFileSync(process.execPath, ["--check", launcher]);

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port =
        typeof address === "object" && address
          ? address.port
          : null;
      server.close(() => resolve(port));
    });
  });
}

function writeExecutable(file, source) {
  writeFileSync(file, source);
  chmodSync(file, 0o755);
}

async function scenario(shouldFail) {
  const dir = mkdtempSync(
    path.join(tmpdir(), "maktablink-dev-api-test-")
  );
  const marker = path.join(dir, "ngrok-started.txt");
  const serverPath = path.join(dir, "fake-api.mjs");
  const port = await freePort();

  const api = [
    'import http from "node:http";',
    'const server = http.createServer((req, res) => {',
    '  res.setHeader("Content-Type","application/json");',
    '  if (req.url === "/health") res.end(JSON.stringify({service:"maktablink-api",status:"ok"}));',
    '  else if (req.url === "/ready") res.end(JSON.stringify({service:"maktablink-api",status:"ready"}));',
    '  else { res.statusCode=404; res.end("{}"); }',
    '});',
    'server.listen(Number(process.env.API_PORT),"127.0.0.1",()=>console.log("fake api_started"));',
    ""
  ].join("\n");

  writeFileSync(serverPath, api);

  writeExecutable(
    path.join(dir, "pnpm"),
    '#!/bin/sh\n' +
      'if [ "$DEV_TEST_FAIL_API" = "1" ]; then echo "simulated startup failure" >&2; exit 41; fi\n' +
      'exec "' +
      process.execPath +
      '" "' +
      serverPath +
      '"\n'
  );

  writeExecutable(
    path.join(dir, "ngrok"),
    '#!/bin/sh\nprintf "%s" "$*" > "$DEV_TEST_NGROK_MARKER"\nsleep 30\n'
  );

  const child = spawn(process.execPath, [launcher], {
    cwd: base,
    env: {
      ...process.env,
      PATH: dir + path.delimiter + (process.env.PATH || ""),
      API_PORT: String(port),
      DEV_TEST_NGROK_MARKER: marker,
      DEV_TEST_FAIL_API: shouldFail ? "1" : "0",
      NODE_ENV: "development"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  let exitCode = null;
  child.on("exit", (code) => {
    exitCode = code;
  });

  const deadline = Date.now() + 9000;

  try {
    while (Date.now() < deadline) {
      if (
        !shouldFail &&
        existsSync(marker) &&
        output.includes("Starting ngrok")
      ) {
        break;
      }
      if (exitCode !== null) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (shouldFail) {
      assert.notEqual(
        exitCode,
        null,
        "Failed API should promptly terminate launcher"
      );
      assert.notEqual(
        exitCode,
        0,
        "Failed API should report nonzero code"
      );
      assert.ok(
        output.includes("simulated startup failure"),
        "API errors must remain visible"
      );
      assert.ok(
        !existsSync(marker),
        "Failed API must not open a tunnel"
      );
    } else {
      assert.equal(
        exitCode,
        null,
        "Healthy launcher should remain running"
      );
      assert.ok(
        existsSync(marker),
        "ngrok should start after API is ready"
      );
      assert.equal(
        readFileSync(marker, "utf8"),
        "http " + port
      );

      const healthy = output.indexOf("API is running");
      const ngrok = output.indexOf("Starting ngrok");

      assert.ok(
        healthy >= 0 && ngrok > healthy,
        "API health must precede ngrok startup"
      );
      assert.ok(
        output.includes("Database readiness confirmed"),
        "Must verify DB readiness"
      );
      assert.ok(
        output.includes("fake api_started"),
        "API stdout must be visible"
      );
    }
  } finally {
    if (exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([
        new Promise((resolve) =>
          child.once("exit", resolve)
        ),
        new Promise((resolve) =>
          setTimeout(resolve, 2500)
        )
      ]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }

    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.platform === "win32") {
  console.log(
    "Skipping POSIX fake CLI supervisor test on Windows."
  );
} else {
  await scenario(false);
  await scenario(true);
  console.log(
    "dev:api supervisor verified: API before tunnel, visible errors, no tunnel on failure."
  );
}
