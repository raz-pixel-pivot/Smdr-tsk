import type { Lang } from "@/lib/types";
import en, { type Dict } from "./en";
import he from "./he";

const dicts: Record<Lang, Dict> = { en, he };

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TKey = Leaves<Dict>;
export type T = (key: TKey, vars?: Record<string, string | number>) => string;

export function makeT(lang: Lang): T {
  const dict = dicts[lang] ?? en;
  return (key, vars) => {
    let s = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], dict) as string | undefined;
    if (typeof s !== "string") s = key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

export const dirOf = (lang: Lang) => (lang === "he" ? "rtl" : "ltr");
export const LANG_COOKIE = "lang";
