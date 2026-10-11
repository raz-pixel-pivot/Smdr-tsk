"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileView({ node, selected }: ReactNodeViewProps) {
  const { href, name, size } = node.attrs as { href: string; name: string; size: number };
  return (
    <NodeViewWrapper as="div" data-drag-handle>
      <a className={`file-chip ${selected ? "ProseMirror-selectednode" : ""}`} href={href} target="_blank" rel="noopener noreferrer" contentEditable={false}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <path d="M10.5 4.5 5.8 9.2a1.4 1.4 0 0 0 2 2l5-5a2.8 2.8 0 0 0-4-4l-5 5a4.2 4.2 0 0 0 6 6l4.2-4.2" />
        </svg>
        <span>{name}</span>
        <span className="file-size">{formatSize(size)}</span>
      </a>
    </NodeViewWrapper>
  );
}

/** A block-level link to an uploaded file, shown as a chip. */
export const FileAttachment = Node.create({
  name: "fileAttachment",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      href: { default: null },
      name: { default: "" },
      size: { default: 0 },
      contentType: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "a[data-file-attachment]",
        getAttrs: (el) => ({
          href: (el as HTMLElement).getAttribute("href"),
          name: (el as HTMLElement).getAttribute("data-name") ?? "",
          size: Number((el as HTMLElement).getAttribute("data-size") ?? 0),
          contentType: (el as HTMLElement).getAttribute("data-type") ?? "",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-file-attachment": "",
        href: node.attrs.href,
        "data-name": node.attrs.name,
        "data-size": node.attrs.size,
        "data-type": node.attrs.contentType,
        class: "file-chip",
      }),
      node.attrs.name,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileView);
  },
});
