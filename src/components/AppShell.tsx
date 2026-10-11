"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { seedIfNeeded } from "@/server/actions";
import { todayIso } from "@/lib/dates";
import type { InitialData } from "@/lib/types";
import { useStore, useT } from "@/store/store";
import { IconGear } from "./icons";
import { ToastBar } from "./Toast";

let seeding: Promise<unknown> | null = null;

export function AppShell({ initial, children }: { initial: InitialData; children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  // The app renders on the client only: "today" is the browser's local date,
  // which the server can't know, and all state lives in the client store.
  useEffect(() => {
    const store = useStore.getState();
    const today = todayIso();
    store.init(initial);
    useStore.setState({ today, selected: today });
    setReady(true);
    if (!initial.settings.seeded && !seeding) {
      seeding = seedIfNeeded(today, initial.settings.language).then((res) => {
        if (res.ok) store.init(res.data);
      });
    }
    // Roll "today" over at midnight or when the tab comes back.
    const tick = () => useStore.getState().setToday(todayIso());
    const timer = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return <div className="boot" aria-busy="true" />;

  return (
    <div className="app">
      <main className="page">
        <Suspense>
          <TopNav />
        </Suspense>
        {children}
      </main>
      <ToastBar />
    </div>
  );
}

function TopNav() {
  const t = useT();
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const today = useStore((s) => s.today);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);

  // A task page belongs to whichever section it was opened from.
  const from = pathname.startsWith("/task/") ? params.get("from") || "daily" : null;
  const section =
    pathname === "/" || from === "daily" ? "daily" : pathname === "/projects" || from === "projects" ? "projects" : pathname === "/timeline" || from === "timeline" ? "timeline" : "";
  const onTodayPage = pathname === "/" && selected === today;

  const tabs = [
    { key: "daily", href: "/", label: t("nav.daily") },
    { key: "projects", href: "/projects", label: t("nav.projects") },
    { key: "timeline", href: "/timeline", label: t("nav.timeline") },
  ];

  return (
    <div className="topbar">
      <nav aria-label={t("nav.main")} className="tabs">
        {tabs.map((tab) => (
          <Link key={tab.key} href={tab.href} className={`tab ${section === tab.key ? "on" : ""}`} aria-current={section === tab.key ? "page" : undefined}>
            {tab.label}
          </Link>
        ))}
      </nav>
      <div className="topbar-end">
        <button
          className={`today-btn ${onTodayPage ? "" : "filled"}`}
          onClick={() => {
            select(today, true);
            if (pathname !== "/") router.push("/");
          }}
        >
          {t("nav.today")}
        </button>
        <Link href="/settings" className={`icon-btn ${pathname === "/settings" ? "on" : ""}`} aria-label={t("nav.settings")}>
          <IconGear />
        </Link>
      </div>
    </div>
  );
}
