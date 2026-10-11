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
];

export function nextColor(usedCount: number) {
  return LABEL_PALETTE[usedCount % LABEL_PALETTE.length];
}
