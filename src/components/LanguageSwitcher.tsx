import { ChevronDown, Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LANGUAGES, type Lang } from "@/lib/translations";
import { cn } from "@/lib/utils";

/** Compact language picker; the choice applies at once and is remembered on this device. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <label className={cn("relative inline-flex h-8 shrink-0 items-center rounded-full border border-border bg-card/95 text-xs font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:border-primary/50 focus-within:ring-2 focus-within:ring-ring print:hidden", className)}>
      <span className="sr-only">{t("language")}</span>
      <Globe className="pointer-events-none absolute left-2.5 size-3.5 text-primary" aria-hidden />
      <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}
        className="h-full cursor-pointer appearance-none rounded-full bg-transparent pl-7 pr-7 outline-none">
        {LANGUAGES.map((l) => <option key={l.id} value={l.id} lang={l.id} className="bg-card text-foreground">{l.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-foreground/60" aria-hidden />
    </label>
  );
}
