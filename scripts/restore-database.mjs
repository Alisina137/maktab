import { createDecipheriv, scryptSync } from "node:crypto";
import { open, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";
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
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + SALT_BYTES + IV_BYTES;

async function readRange(file, start, length) {
  const handle = await open(file, "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, start);
    if (bytesRead !== length) throw new Error("Backup file is truncated.");
    return buffer;
  } finally {
    await handle.close();
  }
}

async function run() {
  await loadRootEnv();
  if (process.env.CONFIRM_RESTORE !== "YES") {
    throw new Error("Restore is destructive. Set CONFIRM_RESTORE=YES to continue.");
  }

  const backupArgument = process.argv[2];
  if (!backupArgument) {
    throw new Error("Provide the encrypted backup path: pnpm restore:db -- backups/<file>.mlbk");
  }

  const inputPath = resolve(repoRoot, backupArgument);
  const databaseUrl = requireSecret("DATABASE_URL");
  const encryptionSecret = requireSecret("BACKUP_ENCRYPTION_KEY", 32);
  const info = await stat(inputPath);
  if (info.size <= HEADER_BYTES + TAG_BYTES) throw new Error("Backup file is too small.");

  const header = await readRange(inputPath, 0, HEADER_BYTES);
  const magic = header.subarray(0, MAGIC.length);
  if (!magic.equals(MAGIC)) throw new Error("Unsupported or invalid MaktabLink backup file.");

  const salt = header.subarray(MAGIC.length, MAGIC.length + SALT_BYTES);
  const iv = header.subarray(MAGIC.length + SALT_BYTES, HEADER_BYTES);
  const tag = await readRange(inputPath, info.size - TAG_BYTES, TAG_BYTES);
  const key = scryptSync(encryptionSecret, salt, 32);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const { env, database } = postgresEnvironment(databaseUrl);
  const restore = spawn(
    "pg_restore",
    [
      "--dbname",
      database,
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-acl",
      "--exit-on-error"
    ],
    { env, stdio: ["pipe", "inherit", "inherit"], windowsHide: true }
  );

  const restoreDone = new Promise((resolveDone, rejectDone) => {
    restore.once("error", (error) => rejectDone(error));
    restore.once("close", (code) => {
      if (code === 0) resolveDone();
      else rejectDone(new Error(`pg_restore exited with code ${code ?? "unknown"}.`));
    });
  });

  try {
    const encryptedInput = createReadStream(inputPath, {
      start: HEADER_BYTES,
      end: info.size - TAG_BYTES - 1
    });
    await Promise.all([
      pipeline(encryptedInput, decipher, restore.stdin),
      restoreDone
    ]);
    console.log("Encrypted database backup restored successfully.");
  } catch (error) {
    restore.kill();
    if (error?.code === "ENOENT") {
      throw new Error("pg_restore was not found. Install PostgreSQL client tools and ensure pg_restore is on PATH.");
    }
    if (error?.code === "ERR_OSSL_BAD_DECRYPT") {
      throw new Error("Backup decryption failed. Check BACKUP_ENCRYPTION_KEY and the backup file.");
    }
    throw error;
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
