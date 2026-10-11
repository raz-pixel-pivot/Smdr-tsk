import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { MAX_FILE_BYTES } from "@/lib/limits";
import { requireUser } from "@/server/auth";

/**
 * Issues short-lived client upload tokens so files go straight from the browser
 * to Vercel Blob (serverless request bodies are capped well below 10 MB).
 */
export async function POST(request: Request) {
  let userId: string;
  try {
    userId = await requireUser();
  } catch {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const { taskId } = JSON.parse(clientPayload || "{}") as { taskId?: string };
        if (!taskId || !pathname.startsWith(`tasks/${taskId}/`)) throw new Error("Invalid upload path");
        const own = await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
        if (!own.length) throw new Error("Task not found");
        return {
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60_000,
        };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 400 });
  }
}
