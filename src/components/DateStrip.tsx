"use client";

import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { addDays, dayOfMonth, diffDays, formatDate, weekday } from "@/lib/dates";
import { dayStats } from "@/lib/derive";
import { useLang, useStore, useT } from "@/store/store";

// Each cell is 56px wide with a 4px gap, so one day = 60px of scroll.
const STRIDE = 60;
const CHUNK = 90; // days added when nearing an edge
const EDGE = 45; // how close to an edge (in days) before extending

/**
 * The strip is always laid out left-to-right internally (dir="ltr") so scroll math
 * is identical in both languages; in Hebrew the day order is reversed so time runs
 * right to left.
 */
export function DateStrip() {
  const t = useT();
  const lang = useLang();
  const rtl = lang === "he";
  const tasks = useStore((s) => s.tasks);
  const today = useStore((s) => s.today);
  const selected = useStore((s) => s.selected);
  const centerSeq = useStore((s) => s.centerSeq);
  const select = useStore((s) => s.select);

  const stats = useMemo(() => dayStats(tasks), [tasks]);

  // Visible range: [start, start + count)
  const [range, setRange] = useState(() => ({ start: addDays(selected, -CHUNK), count: CHUNK * 2 + 1 }));
  const days = useMemo(() => {
    const arr = Array.from({ length: range.count }, (_, i) => addDays(range.start, i));
    return rtl ? arr.reverse() : arr;
  }, [range, rtl]);
  const indexOf = useCallback(
    (iso: string) => {
      const i = diffDays(iso, range.start);
      return rtl ? range.count - 1 - i : i;
    },
    [range, rtl],
  );

  const ref = useRef<HTMLDivElement>(null);
  const pendingShift = useRef(0); // px to add to scrollLeft after the range grows on the left
  const lockUntil = useRef(0); // ignore scroll-driven selection during programmatic scrolls
  const drag = useRef<{ x: number; left: number; moved: boolean; samples: { x: number; t: number }[] } | null>(null);
  const suppressClick = useRef(0);
  const anim = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const scrollToIndex = useCallback((i: number, smooth: boolean) => {
    const el = ref.current;
    if (!el) return;
    lockUntil.current = Date.now() + (smooth ? 700 : 80);
    el.scrollTo({ left: i * STRIDE, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Grow the range so it always contains the given day with room to spare. Computed
  // from a ref (not inside a state updater) so the scroll compensation is applied once.
  const rangeRef = useRef(range);
  const ensureAround = useCallback(
    (iso: string) => {
      const r = rangeRef.current;
      const i = diffDays(iso, r.start);
      if (i >= EDGE && i < r.count - EDGE) return false;
      const addBefore = Math.max(0, CHUNK - i);
      const addAfter = Math.max(0, CHUNK - (r.count - 1 - i));
      // New days on the visual left push content right: compensate the scroll.
      pendingShift.current += (rtl ? addAfter : addBefore) * STRIDE;
      const next = { start: addDays(r.start, -addBefore), count: r.count + addBefore + addAfter };
      rangeRef.current = next;
      setRange(next);
      return true;
    },
    [rtl],
  );

  // A pending request to center the selected day (initial load, day click, Today, jumps).
  const wantCenter = useRef<{ smooth: boolean } | null>({ smooth: false });
  const tryCenter = () => {
    if (!wantCenter.current) return;
    const iso = useStore.getState().selected;
    if (ensureAround(iso)) return; // finish after the range grows
    scrollToIndex(indexOf(iso), wantCenter.current.smooth);
    wantCenter.current = null;
  };

  const firstRun = useRef(true);
  useLayoutEffect(() => {
    if (!firstRun.current) wantCenter.current = { smooth: true };
    firstRun.current = false;
    tryCenter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerSeq]);

  // Switching language reverses the order: jump straight to the selected day.
  const prevRtl = useRef(rtl);
  useLayoutEffect(() => {
    if (prevRtl.current === rtl) return;
    prevRtl.current = rtl;
    wantCenter.current = { smooth: false };
    tryCenter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rtl]);

  // After the range grows: compensate the scroll before paint, then finish any centering.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && pendingShift.current) {
      el.scrollLeft += pendingShift.current;
      // An active mouse drag positions from its start point: move that too.
      if (drag.current) drag.current.left += pendingShift.current;
      pendingShift.current = 0;
    }
    tryCenter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const nearestIndex = () => {
    const el = ref.current!;
    return Math.max(0, Math.min(days.length - 1, Math.round(el.scrollLeft / STRIDE)));
  };

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = nearestIndex();
    const iso = days[i];
    if (iso && Date.now() > lockUntil.current) {
      if (iso !== useStore.getState().selected) select(iso);
      if (i < EDGE || i > days.length - 1 - EDGE) ensureAround(iso);
    }
    // Settle on the nearest day once scrolling stops (CSS snap does this on touch screens;
    // this covers mouse, trackpad and the end of mouse-drag momentum).
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (drag.current || anim.current) return;
      const n = nearestIndex();
      if (Math.abs(el.scrollLeft - n * STRIDE) > 1) el.scrollTo({ left: n * STRIDE, behavior: "smooth" });
    }, 140);
  };

  // Mouse drag with momentum. Touch uses native scrolling.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    cancelAnimationFrame(anim.current);
    anim.current = 0;
    const el = ref.current!;
    drag.current = { x: e.clientX, left: el.scrollLeft, moved: false, samples: [{ x: e.clientX, t: performance.now() }] };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 4) {
      d.moved = true;
      ref.current!.setPointerCapture(e.pointerId);
      ref.current!.classList.add("dragging");
    }
    if (d.moved) {
      ref.current!.scrollLeft = d.left - dx;
      d.samples.push({ x: e.clientX, t: performance.now() });
      if (d.samples.length > 6) d.samples.shift();
    }
  };
  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.moved) return;
    const el = ref.current!;
    el.classList.remove("dragging");
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    suppressClick.current = Date.now();
    const a = d.samples[0];
    const b = d.samples[d.samples.length - 1];
    let v = b.t - a.t > 0 ? -(b.x - a.x) / (b.t - a.t) : 0; // px per ms, in scroll direction
    if (performance.now() - b.t > 80) v = 0; // pointer paused before release
    v = Math.max(-4, Math.min(4, v));
    let last = performance.now();
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      el.scrollLeft += v * dt;
      v *= Math.pow(0.994, dt);
      if (Math.abs(v) > 0.03) {
        anim.current = requestAnimationFrame(step);
      } else {
        anim.current = 0;
        const n = nearestIndex();
        el.scrollTo({ left: n * STRIDE, behavior: "smooth" });
      }
    };
    anim.current = requestAnimationFrame(step);
  };

  const onPick = useCallback(
    (iso: string) => {
      if (Date.now() - suppressClick.current < 250) return;
      select(iso, true);
    },
    [select],
  );

  return (
    <div
      ref={ref}
      dir="ltr"
      className="strip"
      role="group"
      aria-label={t("daily.dateStrip")}
      onScroll={onScroll}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="strip-spacer" aria-hidden />
      {days.map((iso) => {
        const s = stats.get(iso);
        const dot = !s ? "" : s.open === 0 ? "green" : iso < today ? "red" : "grey";
        return (
          <DayCell
            key={iso}
            iso={iso}
            lang={lang}
            selected={iso === selected}
            isToday={iso === today}
            dot={dot}
            onPick={onPick}
          />
        );
      })}
      <div className="strip-spacer" aria-hidden />
    </div>
  );
}

const DayCell = memo(function DayCell({
  iso,
  lang,
  selected,
  isToday,
  dot,
  onPick,
}: {
  iso: string;
  lang: "en" | "he";
  selected: boolean;
  isToday: boolean;
  dot: string;
  onPick: (iso: string) => void;
}) {
  const wd = weekday(iso);
  const num = dayOfMonth(iso);
  return (
    <button
      className={`day ${selected ? "sel" : ""} ${isToday ? "today" : ""} ${wd >= 5 ? "weekend" : ""}`}
      data-iso={iso}
      aria-label={formatDate.full(iso, lang)}
      aria-pressed={selected}
      onClick={() => onPick(iso)}
    >
      <span className="day-wd">{formatDate.weekdayNarrow(iso, lang)}</span>
      <span className="day-num">{num}</span>
      <span className={`day-dot ${dot}`} aria-hidden />
      <span className="day-month">{num === 1 ? formatDate.monthLong(iso, lang) : ""}</span>
    </button>
  );
});
