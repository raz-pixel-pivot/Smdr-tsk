import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";

// userId -> { allowed, email, checkedAt }. Avoids a Clerk API call on every action.
const cache = new Map<string, { allowed: boolean; email: string; at: number }>();
const TTL = 10 * 60_000;

/** Local preview without signing in. Never active in production builds. */
export const DEV_BYPASS = process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "1";
const DEV_USER = "dev-local";

export async function checkUser(): Promise<{ userId: string | null; allowed: boolean; email: string }> {
  if (DEV_BYPASS) return { userId: DEV_USER, allowed: true, email: "dev@localhost" };
  const { userId } = await auth();
  if (!userId) return { userId: null, allowed: false, email: "" };
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL) return { userId, allowed: hit.allowed, email: hit.email };

  const allowedEmail = (process.env.ALLOWED_EMAIL || "").trim().toLowerCase();
  const user = await (await clerkClient()).users.getUser(userId);
  // Only verified addresses count, so nobody can claim the allowed email without proving it.
  const emails = user.emailAddresses
    .filter((e) => e.verification?.status === "verified")
    .map((e) => e.emailAddress.toLowerCase());
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? emails[0] ?? "";
  const allowed = !!allowedEmail && emails.includes(allowedEmail);
  cache.set(userId, { allowed, email: primary, at: Date.now() });
  return { userId, allowed, email: primary };
}

export class AuthError extends Error {}

/** Returns the signed-in, allowed user's id or throws. Every data access goes through this. */
export async function requireUser(): Promise<string> {
  const { userId, allowed } = await checkUser();
  if (!userId) throw new AuthError("Not signed in");
  if (!allowed) throw new AuthError("Not allowed");
  return userId;
}
