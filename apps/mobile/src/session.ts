import * as SecureStore from "expo-secure-store";
import { isSupportedLocale, type SupportedLocale } from "@maktablink/localization";
import type { SchoolOption, SessionPayload } from "./api";
import { validStoredSession, parseParentChildPreferences, updateParentChildPreferences } from "./stored-session-policy";
import { createSerializedWriteQueue } from "./serialized-operations";

const KEY = "maktablink.phase2.session";
const PARENT_CHILD_KEY = "maktablink.parent.selected-child";
const LOCALE_KEY = "maktablink.locale";

export interface StoredSession {
  auth: SessionPayload;
  school: SchoolOption;
}

type ParentChildPreferences = Record<string, string>;

// Sequence writes separately for authentication and parent preferences.
const sessionWrites = createSerializedWriteQueue();
const parentPreferenceWrites = createSerializedWriteQueue();

function parentChildPreferenceKey(schoolId: string, parentUserId: string) {
  return `${schoolId}:${parentUserId}`;
}

async function loadParentChildPreferences(): Promise<ParentChildPreferences> {
  const raw = await SecureStore.getItemAsync(PARENT_CHILD_KEY);
  if (!raw) return Object.create(null) as ParentChildPreferences;
  try {
    return parseParentChildPreferences(JSON.parse(raw));
  } catch {
    await SecureStore.deleteItemAsync(PARENT_CHILD_KEY);
    return Object.create(null) as ParentChildPreferences;
  }
}

export async function loadStoredSession(): Promise<StoredSession | null> {
  // Serialize the entire read + corrupted-record cleanup transaction. Simply
  // draining earlier writes is insufficient: a newer sign-in could write
  // while getItemAsync is pending and be accidentally erased by a stale read.
  return sessionWrites.read(async () => {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      await SecureStore.deleteItemAsync(KEY);
      return null;
    }
    if (validStoredSession(parsed)) return parsed;
    await SecureStore.deleteItemAsync(KEY);
    return null;
  });
}

export async function saveStoredSession(value: StoredSession): Promise<void> {
  if (!validStoredSession(value)) {
    throw new Error("Invalid mobile account or school identity.");
  }
  return sessionWrites.enqueue(() => SecureStore.setItemAsync(KEY, JSON.stringify(value)));
}

export async function clearStoredSession(): Promise<void> {
  return sessionWrites.enqueue(() => SecureStore.deleteItemAsync(KEY));
}


export async function loadPreferredParentChild(
  schoolId: string,
  parentUserId: string
): Promise<string | null> {
  // A read should observe the queue's latest saved selection, without racing
  // a native write enqueued while SecureStore.getItemAsync is pending.
  return parentPreferenceWrites.read(async () => {
    const preferences = await loadParentChildPreferences();
    const value = preferences[parentChildPreferenceKey(schoolId, parentUserId)];
    return typeof value === "string" && value ? value : null;
  });
}

export async function savePreferredParentChild(
  schoolId: string,
  parentUserId: string,
  studentId: string
): Promise<void> {
  // Validate synchronously before queueing any storage write.
  updateParentChildPreferences(null, schoolId, parentUserId, studentId);
  return parentPreferenceWrites.enqueue(async () => {
    const preferences = await loadParentChildPreferences();
    const updated = updateParentChildPreferences(preferences, schoolId, parentUserId, studentId);
    await SecureStore.setItemAsync(PARENT_CHILD_KEY, JSON.stringify(updated));
  });
}


export async function loadPreferredLocale(): Promise<SupportedLocale | null> {
  const value = await SecureStore.getItemAsync(LOCALE_KEY);
  return value && isSupportedLocale(value) ? value : null;
}

export async function savePreferredLocale(locale: SupportedLocale): Promise<void> {
  await SecureStore.setItemAsync(LOCALE_KEY, locale);
}
