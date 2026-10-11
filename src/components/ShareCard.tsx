"use client";

import { useState } from "react";
import type { ShareRole, Task } from "@/lib/types";
import { useStore, useT } from "@/store/store";
import { IconClose, IconShare } from "./icons";

/** Owner: who the task is shared with, and a form to add people. */
export function ShareCard({ task }: { task: Task }) {
  const t = useT();
  const shareTask = useStore((s) => s.shareTask);
  const unshareTask = useStore((s) => s.unshareTask);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("edit");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const v = email.trim();
    if (!v || busy) return;
    setBusy(true);
    if (await shareTask(task.id, v, role)) setEmail("");
    setBusy(false);
  };

  return (
    <section className="card side-card" aria-labelledby="share-h">
      <h2 id="share-h" className="side-head">
        <IconShare size={18} />
        {t("share.title")}
      </h2>
      {task.sharedWith.length === 0 ? (
        <p className="muted small side-text">{t("share.nobody")}</p>
      ) : (
        <ul className="share-list">
          {task.sharedWith.map((s) => (
            <li key={s.email} className="share-row">
              <span className="share-email" dir="ltr">
                {s.email}
              </span>
              <select
                className="field share-role"
                value={s.role}
                aria-label={t("share.roleFor", { email: s.email })}
                onChange={(e) => shareTask(task.id, s.email, e.target.value as ShareRole)}
              >
                <option value="edit">{t("share.canEdit")}</option>
                <option value="view">{t("share.canView")}</option>
              </select>
              <button className="icon-btn" aria-label={t("share.remove", { email: s.email })} title={t("share.remove", { email: s.email })} onClick={() => unshareTask(task.id, s.email)}>
                <IconClose />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="share-form"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          className="field share-input"
          type="email"
          inputMode="email"
          autoComplete="off"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("share.emailPlaceholder")}
          aria-label={t("share.emailPlaceholder")}
        />
        <select className="field share-role" value={role} onChange={(e) => setRole(e.target.value as ShareRole)} aria-label={t("share.roleFor", { email: email || "…" })}>
          <option value="edit">{t("share.canEdit")}</option>
          <option value="view">{t("share.canView")}</option>
        </select>
        <button className="btn btn-accent" type="submit" disabled={busy || !email.trim()}>
          {t("share.add")}
        </button>
      </form>
      <p className="muted small side-text">{t("share.hint")}</p>
    </section>
  );
}

/** Recipient: who shared it, what they may do, and a way out. */
export function SharedBanner({ task, onLeave }: { task: Task; onLeave: () => void }) {
  const t = useT();
  return (
    <div className="shared-banner" role="note">
      <IconShare size={18} />
      <span className="shared-banner-text">
        {t("share.sharedWithYou", { email: task.sharedBy ?? "" })} {task.access === "edit" ? t("share.youCanEdit") : t("share.viewOnly")}
      </span>
      <button className="btn-link" onClick={onLeave}>
        {t("share.leave")}
      </button>
    </div>
  );
}
