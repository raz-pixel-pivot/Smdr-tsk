/** Label colors, assigned in order. All pass 4.5:1 contrast on white as text. */
export const LABEL_PALETTE = [
  "#2563C9",
  "#7A3FC4",
  "#1E7F4F",
  "#B5540A",
  "#0E7490",
  "#A21CAF",
  "#4D7C0F",
  "#B91C1C",
  "#475569",
  "#BE185D",
  "#4338CA",
  "#0F766E",
  "#C2410C",
  "#6D28D9",
  "#15803D",
  "#9F1239",
  "#854D0E",
  "#0369A1",
];

export function nextColor(usedCount: number) {
  return LABEL_PALETTE[usedCount % LABEL_PALETTE.length];
}

/** Editor text colors. All readable on white. */
export const TEXT_COLORS = ["#C22F33", "#C2410C", "#A16207", "#15803D", "#0F766E", "#2563C9", "#6D28D9", "#BE185D", "#55575F"];

/** Editor highlight (background) colors. Light enough for dark text. */
export const HIGHLIGHT_COLORS = ["#FFE58A", "#FFD0A8", "#C9F2C7", "#C7E3FF", "#E5D4FF", "#FFD1E3", "#E4E6EC"];
