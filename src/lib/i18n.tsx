import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LANGUAGES, TRANSLATIONS, type Lang, type TKey } from "@/lib/translations";
import { APP_TEXT } from "@/lib/translations-app";
import { RESULTS_TEXT } from "@/lib/translations-results";

const STORAGE_KEY = "groofai-lang";
let savedLang: string | null = null;
type Vars = Record<string, string | number>;

const fill = (tpl: string, vars?: Vars) => (vars ? tpl.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : tpl);

/** Template to React nodes: {name} takes a node, <b> is bold, <sup> is superscript. */
function renderRich(tpl: string, vars: Record<string, ReactNode> = {}): ReactNode {
  return tpl.split(/(<b>.*?<\/b>|<sup>.*?<\/sup>|\{\w+\})/g).map((part, i) => {
    if (part.startsWith("<b>")) return <span key={i} className="font-semibold text-foreground">{part.slice(3, -4)}</span>;
    if (part.startsWith("<sup>")) return <sup key={i}>{part.slice(5, -6)}</sup>;
    const m = /^\{(\w+)\}$/.exec(part);
    return m ? <Fragment key={i}>{vars[m[1] ?? ""]}</Fragment> : part;
  });
}

type I18n = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TKey, vars?: Vars) => string;
  rich: (key: TKey, vars?: Record<string, ReactNode>) => ReactNode;
  tx: (text: string, vars?: Vars) => string;
};

const make = (lang: Lang, setLang: (lang: Lang) => void): I18n => ({
  lang,
  setLang,
  t: (key, vars) => fill(TRANSLATIONS[lang][key], vars),
  rich: (key, vars) => renderRich(TRANSLATIONS[lang][key], vars),
  tx: (text, vars) => fill(lang === "en" ? text : APP_TEXT[lang][text] ?? RESULTS_TEXT[lang][text] ?? text, vars),
});

// Without a provider (tests, isolated renders) everything reads in English.
const I18nContext = createContext<I18n>(make("en", () => {}));

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  // The saved choice is read after hydration so the server and first client render agree.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      savedLang = saved;
      if (LANGUAGES.some((l) => l.id === saved)) setLangState(saved as Lang);
    } catch {
      // storage unavailable: stay in English
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    // Reveal the page once the saved language is on screen (hidden by the head script).
    if (!LANGUAGES.some((l) => l.id === savedLang) || savedLang === lang) document.documentElement.classList.remove("lang-pending");
  }, [lang]);
  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* choice lasts for this visit only */ }
  }, []);
  const value = useMemo(() => make(lang, setLang), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
