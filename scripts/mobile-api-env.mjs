/**
 * Keep the ignored Expo local API configuration aligned with the active
 * development ngrok tunnel. No production secrets or tracked files are touched.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

export function readMobileApiUrl(file) {
  if (!existsSync(file)) return null;
  const input = readFileSync(file, "utf8");
  const matches = [...input.matchAll(/^\s*EXPO_PUBLIC_API_URL\s*=\s*(.*)$/gm)];
  if (!matches.length) return null;
  return matches[matches.length - 1][1].trim().replace(/^["']|["']$/g, "");
}

export function mobileEnvFile(root) {
  return path.join(root, "apps", "mobile", ".env.local");
}

export function syncMobileApiUrl(file, url) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  ) {
    throw new Error(
      "Only an HTTPS tunnel origin without credentials, query, or path may be synced."
    );
  }

  const clean = parsed.origin;
  const old = existsSync(file) ? readFileSync(file, "utf8") : "";
  const newline = old.includes("\r\n") ? "\r\n" : "\n";
  const lines = old.split(/\r?\n/);
  const kept = lines.filter(
    (line) => !/^\s*EXPO_PUBLIC_API_URL\s*=/.test(line)
  );

  while (kept.length && kept[kept.length - 1] === "") kept.pop();
  kept.push("EXPO_PUBLIC_API_URL=" + clean);

  const next = kept.join(newline) + newline;
  if (next === old) return false;

  mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + ".tmp-" + process.pid;

  try {
    writeFileSync(temp, next, { encoding: "utf8", mode: 0o600 });
    renameSync(temp, file);
  } catch (error) {
    try {
      unlinkSync(temp);
    } catch {
      // Temporary file was not created or was already removed.
    }
    throw error;
  }

  return true;
}
