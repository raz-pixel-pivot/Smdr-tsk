"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { byOrder, labelTasks, rangeText, shortDay, taskOwners } from "@/lib/derive";
import { LABEL_PALETTE } from "@/lib/palette";
import type { Label, Task } from "@/lib/types";
import { useLang, useStore, useT } from "@/store/store";
import { IconPlus } from "./icons";

const NO_OWNER = "\u0000none";

export function Projects() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const labels = useStore((s) => s.labels);
  const tasks = useStore((s) => s.tasks);
  const addLabel = useStore((s) => s.addLabel);
  const [mode, setMode] = useState<"project" | "owner">("project");
  const [ownerFilter, setOwnerFilter] = useState<string>("");
  const [editing, setEditing] = useState<string | null>(params.get("edit"));
  const [draft, setDraft] = useState("");

  // Arriving from the timeline with ?edit=<id>: open that card and scroll to it.
  useEffect(() => {
    const id = params.get("edit");
    if (!id) return;
    setEditing(id);
    setMode("project");
    setOwnerFilter("");
    requestAnimationFrame(() => document.getElementById(`label-${id}`)?.scrollIntoView({ block: "center" }));
  }, [params]);

  const owners = useMemo(() => {
    const set = new Set<string>();
    labels.forEach((l) => l.owner && set.add(l.owner));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [labels]);
  const hasUnowned = labels.some((l) => !l.owner) || Object.values(tasks).some((x) => !x.done && taskOwners(x, labels)[0] === null);

  const visibleLabels = labels.filter((l) => !ownerFilter || (ownerFilter === NO_OWNER ? !l.owner : l.owner === ownerFilter));

  const add = async () => {
    const v = draft.trim();
    if (!v) return;
    setDraft("");
    const id = await addLabel(v);
    if (id) setEditing(id);
  };

  return (
    <div>
      <h1 className="page-title">{t("projects.title")}</h1>
      <div className="page-sub">{t("projects.subtitle")}</div>

      <div className="controls">
        <div className="ctrl">
          <span id="groupby">{t("projects.groupBy")}</span>
          <div className="seg" role="group" aria-labelledby="groupby">
            <button className={mode === "project" ? "on" : ""} aria-pressed={mode === "project"} onClick={() => setMode("project")}>
              {t("projects.byProject")}
            </button>
            <button className={mode === "owner" ? "on" : ""} aria-pressed={mode === "owner"} onClick={() => setMode("owner")}>
              {t("projects.byOwner")}
            </button>
          </div>
        </div>
        <label className="ctrl">
          {t("projects.ownerFilter")}
          <select className="field" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
            <option value="">{t("projects.allOwners")}</option>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
            {hasUnowned && <option value={NO_OWNER}>{t("projects.noOwner")}</option>}
          </select>
        </label>
      </div>

      {mode === "project" ? (
        <div className="grid">
          {visibleLabels.map((l) => (
            <LabelCard
              key={l.id}
              label={l}
              tasks={tasks}
              editing={editing === l.id}
              onEdit={() => {
                setEditing(editing === l.id ? null : l.id);
                if (params.get("edit")) router.replace("/projects");
              }}
            />
          ))}
          {labels.length === 0 && <p className="muted">{t("projects.empty")}</p>}
          <section className="add-card">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) add();
              }}
              aria-label={t("projects.new")}
              placeholder={t("projects.new")}
            />
            <button className="round-btn" aria-label={t("projects.add")} onClick={add}>
              <IconPlus />
            </button>
          </section>
        </div>
      ) : (
        <OwnerView tasks={tasks} labels={labels} owners={owners} filter={ownerFilter} />
      )}
    </div>
  );
}

function LabelCard({ label, tasks, editing, onEdit }: { label: Label; tasks: Record<string, Task>; editing: boolean; onEdit: () => void }) {
  const t = useT();
  const lang = useLang();
  const today = useStore((s) => s.today);
  const updateLabel = useStore((s) => s.updateLabel);
  const deleteLabel = useStore((s) => s.deleteLabel);
  const its = labelTasks(tasks, label.id);
  const done = its.filter((x) => x.done).length;
  const pct = its.length ? Math.round((done / its.length) * 100) : 0;

  const [name, setName] = useState(label.name);
  const [owner, setOwner] = useState(label.owner ?? "");
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => setName(label.name), [label.name]);
  useEffect(() => setOwner(label.owner ?? ""), [label.owner]);
  useEffect(() => {
    if (editing && label.name && nameRef.current && document.activeElement?.tagName !== "INPUT") nameRef.current.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  return (
    <section className="card pcard" id={`label-${label.id}`}>
      <div className="pcard-top">
        <div className="pcard-head">
          <h2 className="pcard-name">
            <span className="dot" style={{ background: label.color }} aria-hidden />
            {label.name}
          </h2>
          <button className="btn-link" aria-expanded={editing} onClick={onEdit}>
            {editing ? t("projects.done") : t("projects.edit")}
          </button>
        </div>
        <div className="small muted">
          {label.owner ? t("projects.ownerIs", { owner: label.owner }) : t("projects.noOwner")} · {rangeText(label, its, lang, t)}
        </div>
        <div className="small muted" style={{ marginBlockStart: 2 }}>
          {its.length ? t("projects.progress", { done, total: its.length }) : t("projects.noTasks")}
        </div>
        <div className="meter" aria-hidden>
          <div style={{ width: `${pct}%`, background: label.color }} />
        </div>
      </div>

      {editing && (
        <div className="pform">
          <label className="field-label">
            {t("projects.name")}
            <input
              ref={nameRef}
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={async (e) => {
                const v = e.target.value.trim();
                if (!v) return setName(label.name);
                if (v !== label.name && !(await updateLabel(label.id, { name: v }))) setName(label.name);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
          </label>
          <label className="field-label">
            {t("projects.owner")}
            <input
              className="field"
              value={owner}
              placeholder={t("projects.ownerPlaceholder")}
              onChange={(e) => setOwner(e.target.value)}
              onBlur={(e) => e.target.value.trim() !== (label.owner ?? "") && updateLabel(label.id, { owner: e.target.value.trim() || null })}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
          </label>
          <label className="field-label">
            {t("projects.start")}
            <input type="date" className="field" value={label.startDate ?? ""} onChange={(e) => updateLabel(label.id, { startDate: e.target.value || null })} />
          </label>
          <label className="field-label">
            {t("projects.end")}
            <input type="date" className="field" value={label.endDate ?? ""} onChange={(e) => updateLabel(label.id, { endDate: e.target.value || null })} />
          </label>
          <div className="field-label full">
            <span id={`color-${label.id}`}>{t("projects.color")}</span>
            <div className="swatches" role="radiogroup" aria-labelledby={`color-${label.id}`}>
              {LABEL_PALETTE.map((c) => (
                <button
                  key={c}
                  role="radio"
                  aria-checked={label.color === c}
                  aria-label={c}
                  className={`swatch ${label.color === c ? "on" : ""}`}
                  style={{ background: c }}
                  onClick={() => updateLabel(label.id, { color: c })}
                />
              ))}
            </div>
          </div>
          <button className="btn-link full" style={{ justifySelf: "start", paddingInline: 0 }} onClick={() => deleteLabel(label.id)}>
            {t("projects.delete")}
          </button>
        </div>
      )}

      {its.map((task) => (
        <Link key={task.id} href={`/task/${task.id}?from=projects`} className={`pitem ${task.done ? "done" : ""}`}>
          <span className="pitem-title">{task.title}</span>
          <span className="pitem-date">{shortDay(task.date, today, lang, t)}</span>
        </Link>
      ))}
    </section>
  );
}

function OwnerView({ tasks, labels, owners, filter }: { tasks: Record<string, Task>; labels: Label[]; owners: string[]; filter: string }) {
  const t = useT();
  const lang = useLang();
  const today = useStore((s) => s.today);

  const groups = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const task of Object.values(tasks)) {
      if (task.done) continue;
      for (const o of taskOwners(task, labels)) {
        const key = o ?? NO_OWNER;
        m.set(key, [...(m.get(key) ?? []), task]);
      }
    }
    m.forEach((list) => list.sort((a, b) => a.date.localeCompare(b.date) || byOrder(a, b)));
    return m;
  }, [tasks, labels]);

  const keys = [...owners, NO_OWNER].filter((k) => !filter || k === filter);

  return (
    <div className="grid">
      {keys.map((k) => {
        const list = groups.get(k) ?? [];
        if (k === NO_OWNER && !list.length && filter !== NO_OWNER) return null;
        return (
          <section className="card pcard" key={k}>
            <div className="pcard-top">
              <h2 className="pcard-name">{k === NO_OWNER ? t("projects.noOwner") : k}</h2>
              <div className="small muted">{list.length ? t("daily.tasksCount", { n: list.length }) : t("projects.noOpen")}</div>
            </div>
            {list.map((task) => (
              <Link key={task.id} href={`/task/${task.id}?from=projects`} className="pitem">
                <span style={{ minWidth: 0 }}>
                  <span className="pitem-title">{task.title}</span>
                  {task.labelIds.length > 0 && (
                    <span className="pitem-labels">
                      {labels
                        .filter((l) => task.labelIds.includes(l.id))
                        .map((l) => (
                          <span key={l.id} style={{ color: l.color }}>
                            {l.name}
                          </span>
                        ))}
                    </span>
                  )}
                </span>
                <span className={`pitem-date ${task.date < today ? "danger" : ""}`}>{shortDay(task.date, today, lang, t)}</span>
              </Link>
            ))}
          </section>
        );
      })}
    </div>
  );
}
