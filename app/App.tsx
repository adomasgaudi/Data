import { Button } from "@/components/ui/button";
import i18n from "@/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useTranslation } from "react-i18next";
import { Link, Outlet } from "react-router-dom";

/** App shell: header nav + language toggle + routed <Outlet/>. */
export function App() {
  const { t } = useTranslation();
  const setLang = useAppStore((s) => s.setLang);

  const toggleLang = () => {
    const next = i18n.language === "lt" ? "en" : "lt";
    i18n.changeLanguage(next);
    try {
      localStorage.setItem("colosseum.lang", next);
    } catch {
      /* storage may be unavailable */
    }
    setLang(next);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-border border-b">
        <nav className="mx-auto flex max-w-4xl items-center gap-4 p-4">
          <span className="font-semibold">{t("app_title")}</span>
          <Link className="text-sm hover:underline" to="/">
            {t("nav_leaderboard")}
          </Link>
          <Link className="text-sm hover:underline" to="/health">
            {t("nav_health")}
          </Link>
          <Button className="ml-auto" variant="outline" size="sm" onClick={toggleLang}>
            {i18n.language === "lt" ? "EN" : "LT"}
          </Button>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl p-4">
        <Outlet />
      </main>
    </div>
  );
}
