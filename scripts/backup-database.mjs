import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import { mkdir, unlink } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { finished } from "node:stream/promises";
import { spawn } from "node:child_process";
import {
  loadRootEnv,
  postgresEnvironment,
  repoRoot,
  requireSecret
} from "./db-tool-common.mjs";

const MAGIC = Buffer.from("MAKTABLINK-BACKUP-V1\n");
const SALT_BYTES = 16;
const IV_BYTES = 12;

function timestamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

async function run() {
  await loadRootEnv();
  const databaseUrl = requireSecret("DATABASE_URL");
  const encryptionSecret = requireSecret("BACKUP_ENCRYPTION_KEY", 32);
  const requested = process.argv[2];
  const outputPath = resolve(
    repoRoot,
    requested || `backups/maktablink-${timestamp()}.mlbk`
  );

  await mkdir(dirname(outputPath), { recursive: true });

  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = scryptSync(encryptionSecret, salt, 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const output = createWriteStream(outputPath, { flags: "wx", mode: 0o600 });
  output.write(MAGIC);
  output.write(salt);
  output.write(iv);

  const { env } = postgresEnvironment(databaseUrl);
  const dump = spawn(
    "pg_dump",
    ["--format=custom", "--no-owner", "--no-acl"],
    { env, stdio: ["ignore", "pipe", "inherit"], windowsHide: true }
  );

  const dumpDone = new Promise((resolveDone, rejectDone) => {
    dump.once("error", (error) => rejectDone(error));
    dump.once("close", (code) => {
      if (code === 0) resolveDone();
      else rejectDone(new Error(`pg_dump exited with code ${code ?? "unknown"}.`));
    });
  });

  dump.stdout.pipe(cipher).pipe(output, { end: false });

  try {
    await dumpDone;
    await finished(cipher);
    output.write(cipher.getAuthTag());
    output.end();
    await finished(output);
    console.log(`Encrypted database backup created: ${basename(outputPath)}`);
  } catch (error) {
    output.destroy();
    await unlink(outputPath).catch(() => undefined);
    if (error?.code === "ENOENT") {
      throw new Error("pg_dump was not found. Install PostgreSQL client tools and ensure pg_dump is on PATH.");
    }
    throw error;
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
