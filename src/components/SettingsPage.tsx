"use client";

import { useClerk } from "@clerk/nextjs";
import { useState } from "react";
import { clearSampleData, importCalendar } from "@/server/actions";
import { CALENDAR_SCOPE } from "@/lib/calendar";
import { addDays } from "@/lib/dates";
import { errorText, useStore, useT } from "@/store/store";
import { useCalendarConnected } from "./CalendarCard";

export function SettingsPage() {
  const t = useT();
  const { signOut } = useClerk();
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const showToast = useStore((s) => s.showToast);
  const hasSample = useStore((s) => s.labels.some((l) => l.isSample) || Object.values(s.tasks).some((x) => x.isSample));
  const [busy, setBusy] = useState(false);

  const clear = async () => {
    if (!window.confirm(t("settings.clearConfirm"))) return;
    setBusy(true);
    const res = await clearSampleData();
    setBusy(false);
    if (!res.ok) return showToast(t("toast.saveFailed", { error: res.error }), undefined, "error");
    const s = useStore.getState();
    useStore.setState({
      tasks: Object.fromEntries(Object.entries(s.tasks).filter(([, x]) => !x.isSample)),
      labels: s.labels.filter((l) => !l.isSample),
    });
    showToast(t("settings.sampleCleared"));
  };

  return (
    <div>
      <h1 className="page-title">{t("settings.title")}</h1>
      <div className="settings">
        <section className="card set-card">
          <h2 id="lang-h">{t("settings.language")}</h2>
          <div className="seg" role="radiogroup" aria-labelledby="lang-h" style={{ display: "inline-flex" }}>
            {(["en", "he"] as const).map((l) => (
              <button key={l} role="radio" aria-checked={settings.language === l} className={settings.language === l ? "on" : ""} onClick={() => updateSettings({ language: l })}>
                {l === "en" ? "English" : "עברית"}
              </button>
            ))}
          </div>
        </section>

        <section className="card set-card">
          <div className="switch-row">
            <span id="sc-label">{t("settings.showCompleted")}</span>
            <button
              role="switch"
              aria-checked={settings.showCompleted}
              aria-labelledby="sc-label"
              className="switch"
              onClick={() => updateSettings({ showCompleted: !settings.showCompleted })}
            />
          </div>
        </section>

        <section className="card set-card">
          <h2>{t("settings.sample")}</h2>
          <p className="muted small" style={{ marginBlock: "0 10px" }}>
            {hasSample ? t("settings.sampleHint") : t("settings.noSample")}
          </p>
          <button className="btn" disabled={!hasSample || busy} onClick={clear}>
            {t("settings.clearSample")}
          </button>
        </section>

        <CalendarSettings />

        <section className="card set-card">
          <h2>{t("settings.account")}</h2>
          <button className="btn btn-accent" onClick={() => signOut({ redirectUrl: "/sign-in" })}>
            {t("settings.signOut")}
          </button>
        </section>
      </div>
    </div>
  );
}

function CalendarSettings() {
  const t = useT();
  const today = useStore((s) => s.today);
  const lang = useStore((s) => s.settings.language);
  const showToast = useStore((s) => s.showToast);
  const { user, google, connected } = useCalendarConnected();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDays(today, 30));
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    if (!user) return;
    setBusy(true);
    try {
      // Comes back to this page after Google asks for permission.
      const redirectUrl = window.location.href;
      const account = google
        ? await google.reauthorize({ additionalScopes: [CALENDAR_SCOPE], redirectUrl })
        : await user.createExternalAccount({ strategy: "oauth_google", redirectUrl, additionalScopes: [CALENDAR_SCOPE] });
      const next = account.verification?.externalVerificationRedirectURL;
      if (next) window.location.href = next.href;
      else {
        await user.reload();
        setBusy(false);
      }
    } catch (e) {
      setBusy(false);
      const msg = (e as { errors?: { longMessage?: string; message?: string }[] })?.errors?.[0];
      showToast(t("calendar.connectFailed", { error: msg?.longMessage ?? msg?.message ?? String(e) }), undefined, "error");
    }
  };

  const run = async () => {
    setBusy(true);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await importCalendar(from, to, tz, lang);
    setBusy(false);
    if (!res.ok) return showToast(errorText(t, res.error), undefined, "error");
    useStore.getState().init(res.data.data);
    const { imported, skipped } = res.data;
    showToast(imported === 0 ? t("calendar.nothingNew") : skipped ? t("calendar.importedSkipped", { n: imported, m: skipped }) : t("calendar.imported", { n: imported }));
  };

  return (
    <section className="card set-card">
      <h2>{t("calendar.title")}</h2>
      <p className="muted small" style={{ marginBlock: "0 10px" }}>
        {connected && google ? t("calendar.connected", { email: google.emailAddress }) : t("calendar.hint")}
      </p>
      {!connected ? (
        <button className="btn btn-accent" disabled={busy || !user} onClick={connect}>
          {t("calendar.connect")}
        </button>
      ) : (
        <>
          <div className="wrap-row">
            <label className="field-label">
              {t("calendar.from")}
              <input type="date" className="field" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
            </label>
            <label className="field-label">
              {t("calendar.to")}
              <input type="date" className="field" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
            </label>
            <button className="btn btn-accent cal-btn" disabled={busy || to < from} onClick={run}>
              {busy ? t("calendar.importing") : t("calendar.import")}
            </button>
          </div>
          <p className="muted small" style={{ marginBlock: "10px 0" }}>
            {t("calendar.importHint")}
          </p>
        </>
      )}
    </section>
  );
}
