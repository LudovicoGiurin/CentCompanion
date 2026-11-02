import jwt from "jsonwebtoken";
import { eq, or, sql } from "drizzle-orm";
import { getDb } from "../../db/index";
import { users, type User } from "../../db/schema";
import { getEnv } from "../runtime";

export type JwtPayload = {
  userId: number;
  email: string;
  username: string;
  role: User["role"];
};

export function signToken(payload: JwtPayload): string {
  const { JWT_SECRET } = getEnv();
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const { JWT_SECRET } = getEnv();
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

function isMissingLocalLeagueCityError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes("local_league_city") || (msg.includes("column") && msg.includes("does not exist"));
}

type LegacyUserRow = {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  role: User["role"];
  email_verified: boolean;
  store_name: string | null;
  display_name: string | null;
  created_at: Date;
  updated_at: Date;
};

function mapLegacyUser(row: LegacyUserRow): User & { id: number } {
  const display = row.display_name?.trim() ?? "";
  const parts = display.split(/\s+/);
  const firstName = parts[0] ?? row.username;
  const lastName = parts.slice(1).join(" ");
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role,
    emailVerified: row.email_verified,
    storeName: row.store_name,
    firstName,
    lastName,
    displayName: row.display_name,
    localLeagueCity: null,
    avatarUrl: null,
    avatarCustom: null,
    coverCustom: null,
    equippedFrame: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function selectLegacyUserById(userId: number): Promise<(User & { id: number }) | null> {
  const db = getDb();
  const result = await db.execute(sql`
    select
      id,
      email,
      username,
      password_hash,
      role,
      email_verified,
      store_name,
      display_name,
      created_at,
      updated_at
    from users
    where id = ${userId}
    limit 1
  `);
  const row = (result as unknown as LegacyUserRow[])[0];
  return row ? mapLegacyUser(row) : null;
}

async function selectLegacyUserByLogin(login: string): Promise<(User & { id: number }) | null> {
  const db = getDb();
  const normalized = login.trim().toLowerCase();
  const username = login.trim();
  const result = await db.execute(sql`
    select
      id,
      email,
      username,
      password_hash,
      role,
      email_verified,
      store_name,
      display_name,
      created_at,
      updated_at
    from users
    where email = ${normalized} or username = ${username}
    limit 1
  `);
  const row = (result as unknown as LegacyUserRow[])[0];
  return row ? mapLegacyUser(row) : null;
}

export async function getAuthUser(req: Request): Promise<(User & { id: number }) | null> {
  const token = getBearerToken(req);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const db = getDb();
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);
    return user ?? null;
  } catch (err) {
    if (!isMissingLocalLeagueCityError(err)) throw err;
    return selectLegacyUserById(payload.userId);
  }
}

export function requireAuth(user: User | null): user is User {
  return user !== null;
}

export function requireRole(user: User, roles: User["role"][]): boolean {
  return roles.includes(user.role);
}

export function handleOptions(): Response {
  return new Response(null, { status: 204 });
}

export function randomToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

export async function findUserByLogin(login: string) {
  const db = getDb();
  const normalized = login.trim().toLowerCase();
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, normalized), eq(users.username, login.trim())))
      .limit(1);
    return user;
  } catch (err) {
    if (!isMissingLocalLeagueCityError(err)) throw err;
    return selectLegacyUserByLogin(login);
  }
}

export type RouteParams = Record<string, string>;
