import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { taskShares } from "@/db/schema";

/** The signed-in user: Clerk id plus their verified email addresses (lowercase). */
export type Me = { id: string; emails: string[]; email: string };

// userId -> { me, checkedAt }. Avoids a Clerk API call on every action.
// Only allowed users are cached, so a newly shared person gets in right away.
const cache = new Map<string, { me: Me; at: number }>();
const TTL = 10 * 60_000;

/** Local preview without signing in. Never active in production builds. */
export const DEV_BYPASS = process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "1";

/** Local preview user. A `dev_email` cookie switches identity, to try sharing between people. */
async function devMe(): Promise<Me> {
  const email = (await cookies()).get("dev_email")?.value?.toLowerCase();
  if (!email) return { id: "dev-local", emails: ["dev@localhost"], email: "dev@localhost" };
  return { id: `dev-${email}`, emails: [email], email };
}

export function allowList() {
  // Comma-separated list of addresses.
  return (process.env.ALLOWED_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * A user may use the planner if one of their verified emails is on ALLOWED_EMAIL,
 * or if someone has shared a task with one of them.
 */
export async function checkUser(): Promise<{ me: Me | null; allowed: boolean; email: string }> {
  if (DEV_BYPASS) {
    const me = await devMe();
    return { me, allowed: true, email: me.email };
  }
  const { userId } = await auth();
  if (!userId) return { me: null, allowed: false, email: "" };
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL) return { me: hit.me, allowed: true, email: hit.me.email };

  const user = await (await clerkClient()).users.getUser(userId);
  // Only verified addresses count, so nobody can claim an allowed email without proving it.
  const emails = user.emailAddresses
    .filter((e) => e.verification?.status === "verified")
    .map((e) => e.emailAddress.toLowerCase());
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress.toLowerCase() ?? emails[0] ?? "";
  const me: Me = { id: userId, emails, email: primary };

  const list = allowList();
  let allowed = emails.some((e) => list.includes(e));
  if (!allowed && emails.length) {
    const shared = await db.select({ email: taskShares.email }).from(taskShares).where(inArray(taskShares.email, emails)).limit(1);
    allowed = shared.length > 0;
  }
  if (allowed) cache.set(userId, { me, at: Date.now() });
  return { me, allowed, email: primary };
}

export class AuthError extends Error {}

/** Returns the signed-in, allowed user or throws. Every data access goes through this. */
export async function requireUser(): Promise<Me> {
  const { me, allowed } = await checkUser();
  if (!me) throw new AuthError("Not signed in");
  if (!allowed) throw new AuthError("Not allowed");
  return me;
}
