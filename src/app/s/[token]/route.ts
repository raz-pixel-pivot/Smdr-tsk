import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { attachments, tasks } from "@/db/schema";
import { serveBlob } from "@/server/files";

/** A file shared publicly: anyone with the link, no sign-in. Turning sharing off kills the link. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{20,40}$/.test(token)) return new Response("Not found", { status: 404 });
  const [file] = await db
    .select({ url: attachments.url, fileName: attachments.fileName, contentType: attachments.contentType })
    .from(attachments)
    .innerJoin(tasks, eq(tasks.id, attachments.taskId))
    .where(and(eq(attachments.publicToken, token), isNull(tasks.deletedAt)));
  if (!file) return new Response("Not found", { status: 404 });
  // Short cache so switching the link off takes effect quickly.
  return serveBlob(file, "private, max-age=60");
}
