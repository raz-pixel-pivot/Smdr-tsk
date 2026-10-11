"use client";

import { useClerk } from "@clerk/nextjs";
import { useState } from "react";
import { clearSampleData } from "@/server/actions";
import { useStore, useT } from "@/store/store";

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
