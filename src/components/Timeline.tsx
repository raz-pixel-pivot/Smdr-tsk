"use client";

import Link from "next/link";
import { useState } from "react";
import { addDays, diffDays, formatDate, startOfWeek } from "@/lib/dates";
import { labelRange, labelTasks, rangeText } from "@/lib/derive";
import { useLang, useStore, useT } from "@/store/store";
import { IconBack, IconForward } from "./icons";

const DAYS = 42; // six weeks

export function Timeline() {
  const t = useT();
  const lang = useLang();
  const labels = useStore((s) => s.labels);
  const tasks = useStore((s) => s.tasks);
  const today = useStore((s) => s.today);
  // Starts on the Sunday of the week before today; previous/next move six weeks.
  const [page, setPage] = useState(0);
  const start = addDays(startOfWeek(today), -7 + page * DAYS);
  const end = addDays(start, DAYS - 1);
  const col = (iso: string) => diffDays(iso, start) + 1;
  const todayIdx = diffDays(today, start);

  return (
    <div>
      <h1 className="page-title">{t("timeline.title")}</h1>
      <div className="page-sub">{t("timeline.subtitle")}</div>

      <div className="tl-nav">
        <button className="icon-btn" aria-label={t("timeline.prev")} onClick={() => setPage(page - 1)}>
          <IconBack />
        </button>
        <span className="range">
          {formatDate.short(start, lang)} – {formatDate.short(end, lang)}
        </span>
        <button className="icon-btn" aria-label={t("timeline.next")} onClick={() => setPage(page + 1)}>
          <IconForward />
        </button>
        {page !== 0 && (
          <button className="btn" onClick={() => setPage(0)}>
            {t("nav.today")}
          </button>
        )}
      </div>

      <div className="card tl">
        <div className="tl-inner">
          {todayIdx >= 0 && todayIdx < DAYS && (
            <div className="tl-today" aria-hidden style={{ insetInlineStart: `calc(150px + (100% - 150px) * ${(todayIdx + 0.5) / DAYS})` }} />
          )}
          <div className="tl-row tl-head">
            <div />
            <div className="tl-weeks">
              {[0, 1, 2, 3, 4, 5].map((w) => (
                <div className="tl-week" key={w}>
                  {formatDate.short(addDays(start, w * 7), lang)}
                </div>
              ))}
            </div>
          </div>

          {labels.map((l) => {
            const its = labelTasks(tasks, l.id);
            const r = labelRange(l, its);
            const visible = r.start && r.end && r.end >= start && r.start <= end;
            const a = visible ? Math.max(col(r.start!), 1) : 0;
            const b = visible ? Math.min(col(r.end!), DAYS) : 0;
            const dots = its.filter((x) => x.date >= start && x.date <= end);
            return (
              <div className="tl-row" key={l.id}>
                <Link href={`/projects?edit=${l.id}`} className="tl-name" style={{ color: "inherit" }}>
                  <span className="tl-name-text">{l.name}</span>
                  <span className="tl-note">{!r.start ? t("projects.noDates") : !visible ? t("timeline.outOfRange") : rangeText(l, its, lang, t)}</span>
                </Link>
                <div className="tl-track">
                  {[0, 1, 2, 3, 4, 5].map((w) => (
                    <div className="tl-gridline" key={w} style={{ gridColumn: `${w * 7 + 1} / span 7` }} aria-hidden />
                  ))}
                  {visible && <div className="tl-bar" aria-hidden style={{ gridColumn: `${a} / ${b + 1}`, background: l.color }} />}
                  {dots.map((x) => (
                    <span
                      key={x.id}
                      className="tl-dot"
                      title={x.title}
                      style={{ gridColumn: `${col(x.date)} / span 1`, borderColor: l.color, background: x.done ? l.color : "#fff" }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {labels.length === 0 && <div className="empty">{t("timeline.empty")}</div>}
        </div>
      </div>

      <div className="legend">
        <span>{t("timeline.legendToday")}</span>
        <span>{t("timeline.legendDone")}</span>
        <span>{t("timeline.legendOpen")}</span>
      </div>
    </div>
  );
}
