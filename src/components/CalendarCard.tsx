"use client";

import Link from "next/link";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { addToCalendar } from "@/server/actions";
import { CALENDAR_SCOPE } from "@/lib/calendar";
import type { Task } from "@/lib/types";
import { errorText, useStore, useT } from "@/store/store";

/** True when the signed-in user has granted Google Calendar access. */
export function useCalendarConnected() {
  const { user } = useUser();
  const google = user?.externalAccounts.find((a) => a.provider === "google");
  return { user, google, connected: !!google?.approvedScopes?.split(/\s+/).includes(CALENDAR_SCOPE) };
}

/** Adds this task to my Google Calendar (all day, or at a time), or updates it. */
export function CalendarCard({ task }: { task: Task }) {
  const t = useT();
  const showToast = useStore((s) => s.showToast);
  const setCalendarLink = useStore((s) => s.setCalendarLink);
  const { connected } = useCalendarConnected();
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await addToCalendar(task.id, time || null, tz);
    setBusy(false);
    if (!res.ok) return showToast(errorText(t, res.error), undefined, "error");
    setCalendarLink(task.id, res.data.htmlLink);
    showToast(t("calendar.added"));
  };

  return (
    <section className="card side-card" aria-labelledby="cal-h">
      <h2 id="cal-h" className="side-head">
        {t("calendar.title")}
      </h2>
      {!connected ? (
        <p className="muted small side-text">
          <Link href="/settings">{t("calendar.notConnected")}</Link>
        </p>
      ) : (
        <>
          <div className="wrap-row">
            <label className="field-label">
              {t("calendar.time")}
              <input type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
            <button className="btn btn-accent cal-btn" disabled={busy} onClick={save}>
              {busy ? t("calendar.saving") : task.calendarLink ? t("calendar.update") : t("calendar.add")}
            </button>
            {task.calendarLink && (
              <a className="btn-link cal-btn" href={task.calendarLink} target="_blank" rel="noopener noreferrer">
                {t("calendar.open")}
              </a>
            )}
          </div>
          <p className="muted small side-text">{t("calendar.timeHint")}</p>
        </>
      )}
    </section>
  );
}
