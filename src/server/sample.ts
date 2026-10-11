import "server-only";
import type { Lang } from "@/lib/types";

// First-run sample content, positioned relative to the user's today.
type SampleLabel = { key: string; name: Record<Lang, string>; color: string; owner?: Record<Lang, string>; start?: number; end?: number };
type SampleTask = { o: number; title: Record<Lang, string>; done?: boolean; labels?: string[]; body?: boolean };

export const SAMPLE_LABELS: SampleLabel[] = [
  { key: "web", name: { en: "Northwind website", he: "אתר Northwind" }, color: "#2563C9", owner: { en: "Raz", he: "רז" }, start: -10, end: 23 },
  { key: "brand", name: { en: "Brand guide", he: "מדריך מותג" }, color: "#7A3FC4" },
  { key: "reno", name: { en: "Renovation", he: "שיפוץ" }, color: "#1E7F4F", owner: { en: "Dana", he: "דנה" }, start: 0, end: 32 },
  { key: "bday", name: { en: "Mom's birthday", he: "יום הולדת לאמא" }, color: "#B5540A", start: 9, end: 9 },
];

export const SAMPLE_TASKS: SampleTask[] = [
  { o: -3, title: { en: "Return the library book", he: "להחזיר ספר לספרייה" } },
  { o: -1, title: { en: "Back up the laptop", he: "לגבות את המחשב" }, done: true },
  { o: -1, title: { en: "Weekly groceries", he: "קניות לשבוע" }, done: true },
  { o: -1, title: { en: "Book a meeting with the accountant", he: "לתאם פגישה עם רואה החשבון" } },
  { o: 0, title: { en: "Send the price quote", he: "לשלוח הצעת מחיר" }, done: true, labels: ["web"] },
  { o: 0, title: { en: "Review the brand guide draft", he: "לעבור על טיוטת מדריך המותג" }, labels: ["brand"], body: true },
  { o: 0, title: { en: "Renew car insurance", he: "לחדש ביטוח רכב" } },
  { o: 0, title: { en: "Buy a present", he: "לקנות מתנה" }, labels: ["bday"] },
  { o: 0, title: { en: "Half an hour of Spanish", he: "חצי שעה ספרדית" }, done: true },
  { o: 0, title: { en: "Call the contractor", he: "להתקשר לקבלן" }, done: true, labels: ["reno"] },
  { o: 0, title: { en: "Sort receipts", he: "לסדר קבלות" } },
  { o: 1, title: { en: "Dashboard kickoff meeting", he: "פגישת התנעה לדשבורד" }, labels: ["web"] },
  { o: 1, title: { en: "Book a restaurant", he: "להזמין מקום למסעדה" }, labels: ["bday"] },
  { o: 1, title: { en: "Pay property tax", he: "לשלם ארנונה" } },
  { o: 2, title: { en: "Choose tiles", he: "לבחור אריחים" }, labels: ["reno"] },
  { o: 2, title: { en: "Spanish lesson", he: "שיעור ספרדית" } },
  { o: 4, title: { en: "Submit the brand guide", he: "להגיש את מדריך המותג" }, labels: ["brand"] },
  { o: 9, title: { en: "Birthday dinner", he: "ארוחת יום ההולדת" }, labels: ["bday"] },
  { o: 16, title: { en: "On-site meeting with the contractor", he: "פגישה עם הקבלן באתר" }, labels: ["reno"] },
  { o: 23, title: { en: "Launch the website", he: "להעלות את האתר לאוויר" }, labels: ["web"] },
];

export function sampleBody(lang: Lang) {
  const t =
    lang === "he"
      ? { h: "מה לבדוק", items: ["שהלוגו מופיע בגרסאות הנכונות", "צבעים וטיפוגרפיה", "דוגמאות שימוש"], p: "להחזיר הערות עד ", b: "יום חמישי" }
      : { h: "What to check", items: ["The logo appears in the right versions", "Colors and typography", "Usage examples"], p: "Send feedback by ", b: "Thursday" };
  return {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: t.h }] },
      {
        type: "bulletList",
        content: t.items.map((text) => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text }] }] })),
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: t.p },
          { type: "text", text: t.b, marks: [{ type: "bold" }] },
          { type: "text", text: "." },
        ],
      },
    ],
  };
}
