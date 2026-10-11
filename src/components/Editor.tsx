"use client";

import { useEffect, useId, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor as TEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import { upload } from "@vercel/blob/client";
import { addAttachment, saveTaskBody } from "@/server/actions";
import { MAX_FILE_BYTES } from "@/lib/limits";
import { HIGHLIGHT_COLORS, TEXT_COLORS } from "@/lib/palette";
import type { Attachment } from "@/lib/types";
import { errorText, useStore, useT } from "@/store/store";
import { ColorSwatches } from "./ColorSwatches";
import { FileAttachment } from "./FileAttachment";

export function Editor({
  taskId,
  initial,
  editable = true,
  onUploaded,
}: {
  taskId: string;
  initial: object | null;
  editable?: boolean;
  onUploaded?: (file: Attachment) => void;
}) {
  const t = useT();
  const setHasBody = useStore((s) => s.setHasBody);
  const showToast = useStore((s) => s.showToast);
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<(() => Promise<void>) | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // Paste/drop handlers are created once, so they reach the editor through a ref.
  const edRef = useRef<TEditor | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: true, autolink: true, defaultProtocol: "https" },
        codeBlock: false,
        code: false,
      }),
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["start", "center", "end"], defaultAlignment: null }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false }),
      FileAttachment,
      Placeholder.configure({ placeholder: t("task.bodyPlaceholder") }),
    ],
    content: initial ?? "",
    editorProps: {
      attributes: { "aria-label": t("task.bodyLabel"), role: "textbox", "aria-multiline": "true", dir: "auto" },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (!files.length) return false;
        files.forEach((f) => uploadFile(f));
        return true;
      },
      handleDrop: (_view, event) => {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []);
        if (!files.length) return false;
        event.preventDefault();
        files.forEach((f) => uploadFile(f));
        return true;
      },
    },
    onUpdate: ({ editor }) => scheduleSave(editor),
  });
  edRef.current = editor;

  // Follow permission changes (e.g. the owner switches someone to "Can edit").
  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  // Saves shortly after typing stops, and immediately when leaving the page.
  function scheduleSave(ed: TEditor) {
    clearTimeout(timer.current);
    const run = async () => {
      pending.current = null;
      const empty = ed.isEmpty;
      const json = empty ? null : JSON.stringify(ed.getJSON());
      setStatus(t("task.saving"));
      const res = await saveTaskBody(taskId, json);
      setStatus("");
      if (res.ok) setHasBody(taskId, !empty);
      else showToast(errorText(t, res.error), undefined, "error");
    };
    pending.current = run;
    timer.current = setTimeout(run, 600);
  }

  useEffect(() => {
    const flush = () => {
      clearTimeout(timer.current);
      pending.current?.();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  async function uploadFile(file: File) {
    const editor = edRef.current;
    if (!editor) return;
    if (file.size > MAX_FILE_BYTES) {
      showToast(t("task.tooBig", { name: file.name }), undefined, "error");
      return;
    }
    setStatus(t("task.uploading", { name: file.name }));
    try {
      const safe = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(-120) || "file";
      const blob = await upload(`tasks/${taskId}/${safe}`, file, {
        access: "private",
        handleUploadUrl: "/api/upload",
        clientPayload: JSON.stringify({ taskId }),
        contentType: file.type || undefined,
      });
      const res = await addAttachment({ taskId, fileName: file.name, contentType: file.type || "application/octet-stream", size: file.size, url: blob.url });
      if (!res.ok) throw new Error(errorText(t, res.error));
      const att = res.data;
      onUploaded?.(att);
      // The editor links to the app's own file address, which checks access.
      const node = file.type.startsWith("image/")
        ? { type: "image", attrs: { src: att.url, alt: file.name } }
        : { type: "fileAttachment", attrs: { href: att.url, name: file.name, size: file.size, contentType: file.type } };
      // A trailing paragraph moves the cursor past the new node, so the next insert doesn't replace it.
      editor.chain().focus().insertContent([node, { type: "paragraph" }]).run();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), undefined, "error");
    } finally {
      setStatus("");
    }
  }

  return (
    <section className="card editor-card">
      {editor && editable && <Toolbar editor={editor} onImage={() => imageInput.current?.click()} onFile={() => fileInput.current?.click()} />}
      <div className="editor-status" aria-live="polite">
        {status}
      </div>
      <EditorContent editor={editor} />
      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          Array.from(e.target.files ?? []).forEach(uploadFile);
          e.target.value = "";
        }}
      />
      <input
        ref={fileInput}
        type="file"
        hidden
        onChange={(e) => {
          Array.from(e.target.files ?? []).forEach(uploadFile);
          e.target.value = "";
        }}
      />
    </section>
  );
}

const B = ({ on, label, onClick, children, disabled, style }: { on?: boolean; label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; style?: React.CSSProperties }) => (
  <button
    type="button"
    className={`tool ${on ? "on" : ""}`}
    aria-label={label}
    title={label}
    aria-pressed={on}
    disabled={disabled}
    style={style}
    // Keep the editor selection when clicking toolbar buttons.
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
  >
    {children}
  </button>
);
const Sep = () => <span className="tool-sep" aria-hidden />;

/** A toolbar button that opens a small panel of color swatches. */
function ColorMenu({
  label,
  title,
  colors,
  value,
  noneLabel,
  onPick,
  onNone,
  children,
}: {
  label: string;
  title: string;
  colors: string[];
  value: string | null;
  noneLabel: string;
  onPick: (color: string) => void;
  onNone: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div className="tool-menu" ref={wrap}>
      <button
        type="button"
        className={`tool ${value ? "on-soft" : ""}`}
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={id}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen(!open)}
      >
        {children}
        <span className="caret" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="color-pop" id={id} role="group" aria-label={title}>
          <ColorSwatches
            colors={colors}
            value={value}
            keepFocus
            onPick={(color) => {
              onPick(color);
              setOpen(false);
            }}
          />
          <button
            type="button"
            className="btn-link color-none"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onNone();
              setOpen(false);
            }}
          >
            {noneLabel}
          </button>
        </div>
      )}
    </div>
  );
}

function Toolbar({ editor, onImage, onFile }: { editor: TEditor; onImage: () => void; onFile: () => void }) {
  const t = useT();
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      task: e.isActive("taskList"),
      start: e.isActive({ textAlign: "start" }),
      center: e.isActive({ textAlign: "center" }),
      end: e.isActive({ textAlign: "end" }),
      highlight: (e.getAttributes("highlight").color as string | undefined) ?? (e.isActive("highlight") ? HIGHLIGHT_COLORS[0] : null),
      color: (e.getAttributes("textStyle").color as string | undefined) ?? null,
      link: e.isActive("link"),
      table: e.isActive("table"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();

  return (
    <div role="toolbar" aria-label={t("toolbar.label")} className="toolbar">
      <B on={s.bold} label={t("toolbar.bold")} onClick={() => c().toggleBold().run()} style={{ fontWeight: 800 }}>B</B>
      <B on={s.italic} label={t("toolbar.italic")} onClick={() => c().toggleItalic().run()} style={{ fontStyle: "italic" }}>I</B>
      <B on={s.underline} label={t("toolbar.underline")} onClick={() => c().toggleUnderline().run()} style={{ textDecoration: "underline" }}>U</B>
      <B on={s.strike} label={t("toolbar.strike")} onClick={() => c().toggleStrike().run()} style={{ textDecoration: "line-through" }}>S</B>
      <Sep />
      <B on={s.h2} label={t("toolbar.heading")} onClick={() => c().toggleHeading({ level: 2 }).run()} style={{ fontWeight: 700 }}>{t("toolbar.heading")}</B>
      <B on={s.h3} label={t("toolbar.subheading")} onClick={() => c().toggleHeading({ level: 3 }).run()} style={{ fontWeight: 500 }}>{t("toolbar.subheading")}</B>
      <B label={t("toolbar.paragraph")} onClick={() => c().setParagraph().run()}>{t("toolbar.paragraph")}</B>
      <Sep />
      <B on={s.bullet} label={t("toolbar.bulletList")} onClick={() => c().toggleBulletList().run()}>
        <ListIcon kind="bullet" />
      </B>
      <B on={s.ordered} label={t("toolbar.orderedList")} onClick={() => c().toggleOrderedList().run()}>
        <ListIcon kind="ordered" />
      </B>
      <B on={s.task} label={t("toolbar.taskList")} onClick={() => c().toggleTaskList().run()}>
        <ListIcon kind="task" />
      </B>
      <Sep />
      <B on={s.start} label={t("toolbar.alignStart")} onClick={() => c().setTextAlign("start").run()}>
        <AlignIcon kind="start" />
      </B>
      <B on={s.center} label={t("toolbar.alignCenter")} onClick={() => c().setTextAlign("center").run()}>
        <AlignIcon kind="center" />
      </B>
      <B on={s.end} label={t("toolbar.alignEnd")} onClick={() => c().setTextAlign("end").run()}>
        <AlignIcon kind="end" />
      </B>
      <Sep />
      <ColorMenu
        label={t("colors.highlight")}
        title={t("colors.highlight")}
        colors={HIGHLIGHT_COLORS}
        value={s.highlight}
        noneLabel={t("colors.noHighlight")}
        onPick={(color) => c().setHighlight({ color }).run()}
        onNone={() => c().unsetHighlight().run()}
      >
        <span style={{ background: s.highlight ?? HIGHLIGHT_COLORS[0], padding: "0 4px", borderRadius: 3 }}>{t("toolbar.highlight")}</span>
      </ColorMenu>
      <ColorMenu
        label={t("colors.text")}
        title={t("colors.text")}
        colors={TEXT_COLORS}
        value={s.color}
        noneLabel={t("colors.none")}
        onPick={(color) => c().setColor(color).run()}
        onNone={() => c().unsetColor().run()}
      >
        <span style={{ color: s.color ?? TEXT_COLORS[0], fontWeight: 700 }}>{t("toolbar.color")}</span>
      </ColorMenu>
      <B
        on={s.link}
        label={t("toolbar.link")}
        onClick={() => {
          const prev = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt(t("toolbar.linkPrompt"), prev ?? "https://");
          if (url === null) return;
          if (!url.trim() || url.trim() === "https://") c().extendMarkRange("link").unsetLink().run();
          else c().extendMarkRange("link").setLink({ href: url.trim() }).run();
        }}
      >
        {t("toolbar.link")}
      </B>
      <B label={t("toolbar.table")} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        {t("toolbar.table")}
      </B>
      {s.table && (
        <>
          <B label={t("toolbar.tableAddRow")} onClick={() => c().addRowAfter().run()}>{t("toolbar.tableAddRow")}</B>
          <B label={t("toolbar.tableAddCol")} onClick={() => c().addColumnAfter().run()}>{t("toolbar.tableAddCol")}</B>
          <B label={t("toolbar.tableDelete")} onClick={() => c().deleteTable().run()}>{t("toolbar.tableDelete")}</B>
        </>
      )}
      <B label={t("toolbar.image")} onClick={onImage}>{t("toolbar.image")}</B>
      <B label={t("toolbar.file")} onClick={onFile}>{t("toolbar.file")}</B>
      <Sep />
      <B label={t("toolbar.clear")} onClick={() => c().unsetAllMarks().clearNodes().run()}>{t("toolbar.clear")}</B>
      <B label={t("toolbar.undo")} disabled={!s.canUndo} onClick={() => c().undo().run()}>
        <HistoryIcon kind="undo" />
      </B>
      <B label={t("toolbar.redo")} disabled={!s.canRedo} onClick={() => c().redo().run()}>
        <HistoryIcon kind="redo" />
      </B>
    </div>
  );
}

const svg = { width: 18, height: 18, viewBox: "0 0 18 18", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, "aria-hidden": true };

function ListIcon({ kind }: { kind: "bullet" | "ordered" | "task" }) {
  return (
    <svg {...svg}>
      <path d="M7 4.5h8M7 9h8M7 13.5h8" />
      {kind === "bullet" && (
        <>
          <circle cx="3.2" cy="4.5" r="0.9" fill="currentColor" />
          <circle cx="3.2" cy="9" r="0.9" fill="currentColor" />
          <circle cx="3.2" cy="13.5" r="0.9" fill="currentColor" />
        </>
      )}
      {kind === "ordered" && <path d="M2.5 3.5h1v3M2.3 8.2c.4-.6 1.8-.6 1.8.3 0 .7-1.8 1.4-1.8 2h1.9" strokeWidth={1.2} />}
      {kind === "task" && (
        <>
          <rect x="1.8" y="3" width="3" height="3" rx="0.6" strokeWidth={1.2} />
          <path d="m2 9.2 1 1 1.8-2" strokeWidth={1.2} />
          <rect x="1.8" y="12" width="3" height="3" rx="0.6" strokeWidth={1.2} />
        </>
      )}
    </svg>
  );
}

/** Logical alignment icons: "start" lines hug the start edge (flipped in RTL). */
function AlignIcon({ kind }: { kind: "start" | "center" | "end" }) {
  const d = kind === "start" ? "M3 4.5h12M3 9h8M3 13.5h10" : kind === "center" ? "M3 4.5h12M5 9h8M4 13.5h10" : "M3 4.5h12M7 9h8M5 13.5h10";
  return (
    <svg {...svg} className="flip-rtl">
      <path d={d} />
    </svg>
  );
}

function HistoryIcon({ kind }: { kind: "undo" | "redo" }) {
  return (
    <svg {...svg} className="flip-rtl" style={kind === "redo" ? { scale: "-1 1" } : undefined}>
      <path d="M6.5 4 3 7.5 6.5 11" />
      <path d="M3.5 7.5h7a4 4 0 0 1 0 8H8" />
    </svg>
  );
}
