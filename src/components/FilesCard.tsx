"use client";

import { useState } from "react";
import { setAttachmentPublic } from "@/server/actions";
import type { Attachment } from "@/lib/types";
import { errorText, useStore, useT } from "@/store/store";
import { formatSize } from "./FileAttachment";

/** The task's files: private by default, each with an optional public link. */
export function FilesCard({ files, canEdit, onChange }: { files: Attachment[]; canEdit: boolean; onChange: (f: Attachment) => void }) {
  const t = useT();
  const showToast = useStore((s) => s.showToast);
  const [busy, setBusy] = useState<string | null>(null);
  if (!files.length) return null;

  const toggle = async (f: Attachment) => {
    setBusy(f.id);
    const res = await setAttachmentPublic(f.id, !f.publicUrl);
    setBusy(null);
    if (!res.ok) return showToast(errorText(t, res.error), undefined, "error");
    onChange({ ...f, publicUrl: res.data.publicUrl });
  };
  const copy = async (f: Attachment) => {
    if (!f.publicUrl) return;
    const url = new URL(f.publicUrl, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      showToast(t("files.copied"));
    } catch {
      window.prompt(t("files.copy"), url);
    }
  };

  return (
    <section className="card side-card" aria-labelledby="files-h">
      <h2 id="files-h" className="side-head">
        {t("files.title")}
      </h2>
      <p className="muted small side-text">{t("files.privateNote")}</p>
      <ul className="file-list">
        {files.map((f) => (
          <li key={f.id} className="file-row">
            <a className="file-name" href={f.url} target="_blank" rel="noopener noreferrer">
              <span>{f.fileName}</span>
              <span className="file-size">{formatSize(f.size)}</span>
            </a>
            <div className="file-actions">
              {canEdit && (
                <span className="switch-row compact">
                  <span id={`pub-${f.id}`} className="small">
                    {t("files.public")}
                    <span className="sr-only"> · {f.fileName}</span>
                  </span>
                  <button
                    role="switch"
                    aria-checked={!!f.publicUrl}
                    aria-labelledby={`pub-${f.id}`}
                    className="switch"
                    disabled={busy === f.id}
                    onClick={() => toggle(f)}
                  />
                </span>
              )}
              {f.publicUrl && (
                <button className="btn" onClick={() => copy(f)}>
                  {t("files.copy")}
                </button>
              )}
            </div>
            {f.publicUrl && <p className="small file-public-note">{t("files.publicOn")}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
