import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { MAX_FILE_BYTES } from "@/lib/limits";
import { requireAccess } from "@/server/access";
import { requireUser, type Me } from "@/server/auth";

/**
 * Issues short-lived client upload tokens so files go straight from the browser
 * to the private Vercel Blob store (serverless request bodies are capped well below 10 MB).
 */
export async function POST(request: Request) {
  let me: Me;
  try {
    me = await requireUser();
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
        await requireAccess(me, taskId, "edit");
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
