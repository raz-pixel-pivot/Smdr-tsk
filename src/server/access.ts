import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { taskShares, tasks } from "@/db/schema";
import type { Access } from "@/lib/types";
import type { Me } from "./auth";

const RANK: Record<Access, number> = { view: 1, edit: 2, owner: 3 };

/** What this user may do with a (live) task: owner, edit, view, or nothing. */
export async function taskAccess(me: Me, taskId: string): Promise<Access | null> {
  const [own, shares] = await db.batch([
    db
      .select({ userId: tasks.userId })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt))),
    db
      .select({ role: taskShares.role })
      .from(taskShares)
      .where(and(eq(taskShares.taskId, taskId), inArray(taskShares.email, me.emails.length ? me.emails : [""]))),
  ]);
  if (!own.length) return null;
  if (own[0].userId === me.id) return "owner";
  if (shares.some((s) => s.role === "edit")) return "edit";
  return shares.length ? "view" : null;
}

/** Throws unless the user has at least `need` on the task. Hidden tasks read as "not found". */
export async function requireAccess(me: Me, taskId: string, need: Access): Promise<Access> {
  const access = await taskAccess(me, taskId);
  if (!access) throw new Error("Task not found");
  if (RANK[access] < RANK[need]) throw new Error(need === "owner" ? "Only the owner can do this" : "View only");
  return access;
}
