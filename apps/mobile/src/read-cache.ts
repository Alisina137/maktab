import * as SecureStore from "expo-secure-store";

const CACHE_VERSION = 1;
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SERIALIZED_LENGTH = 6000;

let scope: string | null = null;
let fallbackListener: ((savedAt: string) => void) | null = null;

type Envelope<T> = {
  version: number;
  savedAt: string;
  data: T;
};

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16);
}

function cacheKey(path: string) {
  return scope ? `maktablink.read.${hash(`${scope}|${path}`)}` : null;
}

export function setReadCacheScope(nextScope: string | null) {
  scope = nextScope;
}

export function setReadCacheFallbackListener(
  listener: ((savedAt: string) => void) | null
) {
  fallbackListener = listener;
}

export async function writeReadCache<T>(path: string, data: T) {
  const key = cacheKey(path);
  if (!key) return;

  try {
    const serialized = JSON.stringify({
      version: CACHE_VERSION,
      savedAt: new Date().toISOString(),
      data
    } satisfies Envelope<T>);
    if (serialized.length > MAX_SERIALIZED_LENGTH) return;
    await SecureStore.setItemAsync(key, serialized);
  } catch {
    // Cache failure must never break a successful network read.
  }
}

export async function readReadCache<T>(path: string): Promise<Envelope<T> | null> {
  const key = cacheKey(path);
  if (!key) return null;

  try {
    const serialized = await SecureStore.getItemAsync(key);
    if (!serialized) return null;
    const envelope = JSON.parse(serialized) as Envelope<T>;
    if (envelope.version !== CACHE_VERSION) return null;
    if (Date.now() - new Date(envelope.savedAt).getTime() > MAX_CACHE_AGE_MS) return null;
    return envelope;
  } catch {
    return null;
  }
}

export function notifyReadCacheFallback(savedAt: string) {
  fallbackListener?.(savedAt);
}
