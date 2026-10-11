import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attachments } from "@/db/schema";
import { taskAccess } from "@/server/access";
import { requireUser } from "@/server/auth";
import { serveBlob } from "@/server/files";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A task's file, for anyone who can see the task. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let me;
  try {
    me = await requireUser();
  } catch {
    return new Response("Not allowed", { status: 401 });
  }
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const [file] = await db.select().from(attachments).where(eq(attachments.id, id));
  if (!file || !(await taskAccess(me, file.taskId))) return new Response("Not found", { status: 404 });
  return serveBlob(file, "private, max-age=300");
}
