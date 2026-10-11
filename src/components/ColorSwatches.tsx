"use client";

import { useRef } from "react";
import { useT } from "@/store/store";

/** A row of color swatches plus a "custom color" picker. */
export function ColorSwatches({
  colors,
  value,
  onPick,
  labelledBy,
  keepFocus,
}: {
  colors: string[];
  value: string | null;
  onPick: (color: string) => void;
  labelledBy?: string;
  /** Keep focus where it is (e.g. inside the text editor). */
  keepFocus?: boolean;
}) {
  const t = useT();
  // The native picker fires on every drag step; save once it settles.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pickLater = (c: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onPick(c), 250);
  };
  const current = value?.toLowerCase() ?? null;
  const isCustom = !!current && !colors.some((c) => c.toLowerCase() === current);
  const hold = keepFocus ? (e: React.MouseEvent) => e.preventDefault() : undefined;
  return (
    <div className="swatches" role="radiogroup" aria-labelledby={labelledBy}>
      {colors.map((c) => {
        const on = current === c.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={t("colors.pick", { color: c })}
            title={c}
            className={`swatch ${on ? "on" : ""}`}
            style={{ background: c }}
            onMouseDown={hold}
            onClick={() => onPick(c)}
          />
        );
      })}
      <label className={`swatch swatch-custom ${isCustom ? "on" : ""}`} title={t("colors.custom")} style={isCustom ? { background: value! } : undefined}>
        <span className="sr-only">{t("colors.custom")}</span>
        <input type="color" value={current && /^#[0-9a-f]{6}$/.test(current) ? current : "#2563c9"} onChange={(e) => pickLater(e.target.value)} />
      </label>
    </div>
  );
}
