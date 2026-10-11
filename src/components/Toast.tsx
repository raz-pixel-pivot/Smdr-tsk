"use client";

import { usePathname } from "next/navigation";
import { useStore, useT } from "@/store/store";

export function ToastBar() {
  const t = useT();
  const toast = useStore((s) => s.toast);
  const dismiss = useStore((s) => s.dismissToast);
  const pathname = usePathname();
  if (!toast) return null;
  return (
    <div className={`toast-wrap ${pathname === "/" ? "above-capture" : ""}`}>
      <div role={toast.kind === "error" ? "alert" : "status"} className={`toast ${toast.kind}`}>
        <span>{toast.text}</span>
        {toast.undo ? (
          <button
            className="toast-action"
            onClick={() => {
              toast.undo?.();
              dismiss();
            }}
          >
            {t("toast.undo")}
          </button>
        ) : (
          <button className="toast-action" onClick={dismiss}>
            {t("toast.dismiss")}
          </button>
        )}
      </div>
    </div>
  );
}
