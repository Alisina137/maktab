import type {
  AccountStore,
  AuthenticatedSessionContext,
  User
} from "@maktablink/database";
import { generateSessionToken, hashSessionToken } from "./security.js";

const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
}

export function safeUser(user: User) {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

export async function issueSession(store: AccountStore, user: User): Promise<IssuedSession> {
  const accessToken = generateSessionToken();
  const refreshToken = generateSessionToken();
  const accessExpiresAt = new Date(Date.now() + ACCESS_TTL_MS);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  await store.createSession({
    schoolId: user.schoolId,
    userId: user.id,
    accessTokenHash: hashSessionToken(accessToken),
    refreshTokenHash: hashSessionToken(refreshToken),
    accessExpiresAt,
    refreshExpiresAt
  });

  return {
    accessToken,
    refreshToken,
    accessExpiresAt: accessExpiresAt.toISOString(),
    refreshExpiresAt: refreshExpiresAt.toISOString()
  };
}

export async function rotateSession(store: AccountStore, context: AuthenticatedSessionContext): Promise<IssuedSession | null> {
  const accessToken = generateSessionToken();
  const refreshToken = generateSessionToken();
  const accessExpiresAt = new Date(Date.now() + ACCESS_TTL_MS);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  const rotated = await store.rotateSession(context.session.id, {
    accessTokenHash: hashSessionToken(accessToken),
    refreshTokenHash: hashSessionToken(refreshToken),
    accessExpiresAt,
    refreshExpiresAt
  });
  if (!rotated) return null;

  return {
    accessToken,
    refreshToken,
    accessExpiresAt: accessExpiresAt.toISOString(),
    refreshExpiresAt: refreshExpiresAt.toISOString()
  };
}

function accountUsable(context: AuthenticatedSessionContext): boolean {
  return (
    context.school.status === "ACTIVE" &&
    (context.user.status === "ACTIVE" ||
      context.user.status === "INVITED" ||
      context.user.status === "SUSPENDED")
  );
}

export async function authenticateAccess(store: AccountStore, token: string): Promise<AuthenticatedSessionContext | null> {
  const context = await store.findByAccessTokenHash(hashSessionToken(token));
  if (!context || !accountUsable(context)) return null;
  if (context.session.accessExpiresAt.getTime() <= Date.now()) return null;
  return context;
}

export async function authenticateRefresh(store: AccountStore, token: string): Promise<AuthenticatedSessionContext | null> {
  const context = await store.findByRefreshTokenHash(hashSessionToken(token));
  if (!context || !accountUsable(context)) return null;
  if (context.session.refreshExpiresAt.getTime() <= Date.now()) return null;
  return context;
}

export function bearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}
