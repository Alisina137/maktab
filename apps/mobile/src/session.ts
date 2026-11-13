import * as SecureStore from "expo-secure-store";
import { isSupportedLocale, type SupportedLocale } from "@maktablink/localization";
import type { SchoolOption, SessionPayload } from "./api";
import { validStoredSession, validStudentPreferenceId, parseParentChildPreferences } from "./stored-session-policy";

const KEY = "maktablink.phase2.session";
const PARENT_CHILD_KEY = "maktablink.parent.selected-child";
const LOCALE_KEY = "maktablink.locale";

export interface StoredSession {
  auth: SessionPayload;
  school: SchoolOption;
}

type ParentChildPreferences = Record<string, string>;

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
  await SecureStore.setItemAsync(KEY, JSON.stringify(value));
}

export async function clearStoredSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}


export async function loadPreferredParentChild(
  schoolId: string,
  parentUserId: string
): Promise<string | null> {
  const preferences = await loadParentChildPreferences();
  const value = preferences[parentChildPreferenceKey(schoolId, parentUserId)];
  return typeof value === "string" && value ? value : null;
}

export async function savePreferredParentChild(
  schoolId: string,
  parentUserId: string,
  studentId: string
): Promise<void> {
  if (![schoolId, parentUserId, studentId].every(validStudentPreferenceId)) {
    throw new Error("Cannot save an invalid parent-child preference.");
  }
  const preferences = await loadParentChildPreferences();
  preferences[parentChildPreferenceKey(schoolId, parentUserId)] = studentId;
  await SecureStore.setItemAsync(PARENT_CHILD_KEY, JSON.stringify(preferences));
}


export async function loadPreferredLocale(): Promise<SupportedLocale | null> {
  const value = await SecureStore.getItemAsync(LOCALE_KEY);
  return value && isSupportedLocale(value) ? value : null;
}

export async function savePreferredLocale(locale: SupportedLocale): Promise<void> {
  await SecureStore.setItemAsync(LOCALE_KEY, locale);
}
