"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  VENDOR_STRINGS,
  type VendorLanguage,
  type VendorStringKey,
} from "@/lib/i18n/vendor-dictionary";

const LANGUAGE_STORAGE_KEY = "trefood_vendor_lang";

interface VendorLanguageContextValue {
  language: VendorLanguage;
  lang: VendorLanguage;
  setLanguage: (lang: VendorLanguage) => void;
  toggleLanguage: () => void;
  t: (key: VendorStringKey) => string;
}

const VendorLanguageContext = createContext<VendorLanguageContextValue | undefined>(undefined);

export function VendorLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<VendorLanguage>("en");

  // Load language preference from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored === "hi" || stored === "en") {
        setLanguageState(stored);
      }
    } catch {
      // localStorage may fail in restricted/incognito modes
    }
  }, []);

  const setLanguage = useCallback((next: VendorLanguage) => {
    setLanguageState(next);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "en" ? "hi" : "en");
  }, [language, setLanguage]);

  const t = useCallback(
    (key: VendorStringKey): string => {
      const item = VENDOR_STRINGS[key];
      if (!item) return String(key);
      return item[language] || item.en || String(key);
    },
    [language],
  );

  return (
    <VendorLanguageContext.Provider
      value={{ language, lang: language, setLanguage, toggleLanguage, t }}
    >
      {children}
    </VendorLanguageContext.Provider>
  );
}

export function useVendorLanguage(): VendorLanguageContextValue {
  const context = useContext(VendorLanguageContext);
  if (!context) {
    // Graceful fallback for components rendered outside the provider (e.g. isolated tests)
    return {
      language: "en",
      lang: "en",
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: (key: VendorStringKey) => VENDOR_STRINGS[key]?.en ?? String(key),
    };
  }
  return context;
}
