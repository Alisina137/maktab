import * as SecureStore from "expo-secure-store";
import type { SchoolOption, SessionPayload } from "./api.js";

const KEY = "maktablink.phase2.session";

export interface StoredSession {
  auth: SessionPayload;
  school: SchoolOption;
}

export async function loadStoredSession(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    await SecureStore.deleteItemAsync(KEY);
    return null;
  }
}

export async function saveStoredSession(value: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(value));
}

export async function clearStoredSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
