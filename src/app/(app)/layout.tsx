import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { checkUser } from "@/server/auth";
import { loadAll } from "@/server/data";
import { requestLang } from "@/lib/server-lang";
import { makeT } from "@/i18n";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const lang = await requestLang();
  const { userId, allowed, email } = await checkUser();

  if (!userId) redirect("/sign-in");
  if (!allowed) {
    const t = makeT(lang);
    return (
      <main className="auth-page">
        <div className="card notice">
          <p>{t("auth.notAllowed")}</p>
          {email && <p className="muted">{t("auth.signedInAs", { email })}</p>}
          <SignOutButton redirectUrl="/sign-in">
            <button className="btn btn-accent">{t("settings.signOut")}</button>
          </SignOutButton>
        </div>
      </main>
    );
  }

  const data = await loadAll(userId, lang);
  return <AppShell initial={data}>{children}</AppShell>;
}
