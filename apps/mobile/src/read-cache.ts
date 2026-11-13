import * as SecureStore from "expo-secure-store";
import { cacheEnvelopeBelongsTo, cacheIsCurrent, cacheScopeMatches } from "./read-cache-policy";

const CACHE_VERSION = 2;
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SERIALIZED_LENGTH = 6000;

let scope: string | null = null;
let scopeEpoch = 0;
let fallbackListener: ((savedAt: string) => void) | null = null;

type Envelope<T> = {
  version: number;
  owner: string;
  path: string;
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

function cacheKey(path: string, expectedScope: string | null) {
  return expectedScope ? `maktablink.read.${hash(`${expectedScope}|${path}`)}` : null;
}

export function getReadCacheScope(): string | null {
  return scope;
}

export function getReadCacheEpoch(): number {
  return scopeEpoch;
}

export function setReadCacheScope(nextScope: string | null) {
  // A -> logged out -> A is a new authorization epoch, even when the account
  // and school IDs eventually match. Never accept a late response from A1.
  if (scope !== nextScope) scopeEpoch += 1;
  scope = nextScope;
}

export function setReadCacheFallbackListener(
  listener: ((savedAt: string) => void) | null
) {
  fallbackListener = listener;
}

export async function writeReadCache<T>(
  path: string, data: T, expectedScope: string | null = scope
) {
  // A GET started by account A can resolve after account B signs in. Never
  // write its response into B's cache namespace or repopulate an old screen.
  if (!cacheScopeMatches(expectedScope, scope)) return;
  const key = cacheKey(path, expectedScope);
  if (!key || !expectedScope) return;

  try {
    const serialized = JSON.stringify({
      version: CACHE_VERSION,
      owner: expectedScope,
      path,
      savedAt: new Date().toISOString(),
      data
    } satisfies Envelope<T>);
    if (serialized.length > MAX_SERIALIZED_LENGTH ||
      !cacheScopeMatches(expectedScope, scope)) return;
    await SecureStore.setItemAsync(key, serialized);
  } catch {
    // Cache failure must never break a successful network read.
  }
}

export async function readReadCache<T>(
  path: string, expectedScope: string | null = scope
): Promise<Envelope<T> | null> {
  if (!cacheScopeMatches(expectedScope, scope)) return null;
  const key = cacheKey(path, expectedScope);
  if (!key) return null;

  try {
    const serialized = await SecureStore.getItemAsync(key);
    if (!serialized || !cacheScopeMatches(expectedScope, scope)) return null;
    const envelope = JSON.parse(serialized) as Envelope<T>;
    if (!cacheEnvelopeBelongsTo(envelope, expectedScope, path, CACHE_VERSION) ||
      !cacheIsCurrent(envelope.savedAt, Date.now(), MAX_CACHE_AGE_MS)) return null;
    return cacheScopeMatches(expectedScope, scope) ? envelope : null;
  } catch {
    return null;
  }
}

export function notifyReadCacheFallback(savedAt: string) {
  fallbackListener?.(savedAt);
}
