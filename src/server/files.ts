import "server-only";
import { get } from "@vercel/blob";

// Types a browser may show inline. Everything else downloads, so an uploaded
// HTML or SVG file can never run as a page on the app's own origin.
const INLINE = /^(image\/(png|jpe?g|gif|webp|avif|heic|heif)|application\/pdf|text\/plain|audio\/[\w.+-]+|video\/[\w.+-]+)$/i;

/** Streams a private blob with safe headers. */
export async function serveBlob(file: { url: string; fileName: string; contentType: string }, cacheControl: string) {
  const res = await get(file.url, { access: "private" });
  if (!res || res.statusCode !== 200) return new Response("Not found", { status: 404 });
  const type = file.contentType || res.blob.contentType || "application/octet-stream";
  const inline = INLINE.test(type);
  const name = encodeURIComponent(file.fileName).replace(/['()]/g, escape);
  const headers: Record<string, string> = {
    "Content-Type": inline ? type : "application/octet-stream",
    "Content-Length": String(res.blob.size),
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${name}`,
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
  };
  // Browsers' built-in PDF viewers refuse to run inside a sandboxed page.
  if (!/pdf/i.test(type)) headers["Content-Security-Policy"] = "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'";
  return new Response(res.stream, { headers });
}
