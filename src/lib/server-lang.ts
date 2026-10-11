import "server-only";
import { cookies, headers } from "next/headers";
import { LANG_COOKIE } from "@/i18n";
import type { Lang } from "./types";

/** Language before settings are loaded: cookie first, then the browser's preference. */
export async function requestLang(): Promise<Lang> {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  if (c === "he" || c === "en") return c;
  const accept = (await headers()).get("accept-language") ?? "";
  return /^\s*(he|iw)\b/i.test(accept) ? "he" : "en";
}
