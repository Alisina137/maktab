import * as SecureStore from "expo-secure-store";
import { isSupportedLocale, type SupportedLocale } from "@maktablink/localization";
import type { SchoolOption, SessionPayload } from "./api";
import { validStoredSession, parseParentChildPreferences, updateParentChildPreferences } from "./stored-session-policy";

const KEY = "maktablink.phase2.session";
const PARENT_CHILD_KEY = "maktablink.parent.selected-child";
const LOCALE_KEY = "maktablink.locale";

export interface StoredSession {
  auth: SessionPayload;
  school: SchoolOption;
}

type ParentChildPreferences = Record<string, string>;

// SecureStore operations can complete out of order. Serialize account updates
// and logout deletes so an old async set can never restore credentials
// after a newer sign-out. Recover the queue after a failed native operation.
let sessionWriteTail: Promise<void> = Promise.resolve();
function enqueueSessionWrite(write: () => Promise<void>): Promise<void> {
  const operation = sessionWriteTail.then(write);
  sessionWriteTail = operation.catch(() => {});
  return operation;
}

// Two parent tabs can select children in rapid succession. Both must read
// the result of the previous write rather than overwriting one another.
let parentPreferenceWriteTail: Promise<void> = Promise.resolve();
function enqueueParentPreferenceWrite(write: () => Promise<void>): Promise<void> {
  const operation = parentPreferenceWriteTail.then(write);
  parentPreferenceWriteTail = operation.catch(() => {});
  return operation;
}

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
  await sessionWriteTail;
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (validStoredSession(parsed)) return parsed;
    await SecureStore.deleteItemAsync(KEY);
    return null;
  } catch {
    await SecureStore.deleteItemAsync(KEY);
    return null;
  }
}

export async function saveStoredSession(value: StoredSession): Promise<void> {
  if (!validStoredSession(value)) {
    throw new Error("Invalid mobile account or school identity.");
  }
  return enqueueSessionWrite(() => SecureStore.setItemAsync(KEY, JSON.stringify(value)));
}

export async function clearStoredSession(): Promise<void> {
  return enqueueSessionWrite(() => SecureStore.deleteItemAsync(KEY));
}


export async function loadPreferredParentChild(
  schoolId: string,
  parentUserId: string
): Promise<string | null> {
  await parentPreferenceWriteTail;
  const preferences = await loadParentChildPreferences();
  const value = preferences[parentChildPreferenceKey(schoolId, parentUserId)];
  return typeof value === "string" && value ? value : null;
}

export async function savePreferredParentChild(
  schoolId: string,
  parentUserId: string,
  studentId: string
): Promise<void> {
  // Validate synchronously before queueing any storage write.
  updateParentChildPreferences(null, schoolId, parentUserId, studentId);
  return enqueueParentPreferenceWrite(async () => {
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
