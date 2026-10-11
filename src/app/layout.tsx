import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { heIL } from "@clerk/localizations";
import { dirOf } from "@/i18n";
import { requestLang } from "@/lib/server-lang";
import "./globals.css";

const heebo = Heebo({ subsets: ["hebrew", "latin"], weight: ["400", "500", "700", "800"], display: "swap" });

export const metadata: Metadata = {
  title: "Planner",
  description: "A personal daily planner",
  appleWebApp: { capable: true, title: "Planner", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F2F3F7",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await requestLang();
  return (
    <ClerkProvider
      localization={lang === "he" ? heIL : undefined}
      appearance={{ variables: { colorPrimary: "#C22F33", fontFamily: "Heebo, sans-serif", borderRadius: "12px" } }}
    >
      <html lang={lang} dir={dirOf(lang)}>
        <body className={heebo.className}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
