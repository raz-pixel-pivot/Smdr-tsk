// Simple stroke icons. Directional ones flip in RTL via the .flip-rtl class.
type P = { size?: number; className?: string };
const base = (size: number) => ({
  width: size,
  height: size,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const IconGear = ({ size = 20, className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base(size)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
export const IconPlus = ({ size = 18, className }: P) => (
  <svg viewBox="0 0 16 16" className={className} {...base(size)} strokeWidth={2}>
    <path d="M8 2v12M2 8h12" />
  </svg>
);
export const IconCheck = ({ size = 14, className }: P) => (
  <svg viewBox="0 0 12 12" className={className} {...base(size)} strokeWidth={2}>
    <path d="m2.5 6.5 2.5 2.5 4.5-5.5" />
  </svg>
);
/** Points "back" (toward the start edge). */
export const IconBack = ({ size = 16, className }: P) => (
  <svg viewBox="0 0 16 16" className={`flip-rtl ${className ?? ""}`} {...base(size)} strokeWidth={2}>
    <path d="m10 3-5 5 5 5" />
  </svg>
);
export const IconForward = ({ size = 16, className }: P) => (
  <svg viewBox="0 0 16 16" className={`flip-rtl ${className ?? ""}`} {...base(size)} strokeWidth={2}>
    <path d="m6 3 5 5-5 5" />
  </svg>
);
export const IconGrip = ({ size = 16, className }: P) => (
  <svg viewBox="0 0 16 16" className={className} width={size} height={size} fill="currentColor" aria-hidden>
    <circle cx="6" cy="4" r="1.2" />
    <circle cx="10" cy="4" r="1.2" />
    <circle cx="6" cy="8" r="1.2" />
    <circle cx="10" cy="8" r="1.2" />
    <circle cx="6" cy="12" r="1.2" />
    <circle cx="10" cy="12" r="1.2" />
  </svg>
);
export const IconNote = ({ size = 13, className }: P) => (
  <svg viewBox="0 0 16 16" className={className} {...base(size)} strokeWidth={1.6}>
    <path d="M4 2.5h6l2.5 2.5v8.5H4z" />
    <path d="M6.5 8h4M6.5 10.5h4" />
  </svg>
);
export const IconChevron = ({ size = 14, className }: P) => (
  <svg viewBox="0 0 16 16" className={className} {...base(size)} strokeWidth={2}>
    <path d="m4 6 4 4 4-4" />
  </svg>
);
