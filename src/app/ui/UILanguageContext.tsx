import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { SUPPORTED_UI_LANGUAGES, translateUI, getUILanguageDisplayName } from "../../domain/ui-i18n.js";

/** Valor por defecto del contexto de idioma UI. */
const UILanguageContext = createContext<{
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string) => string;
  getLanguageDisplayName: (lang: string) => string;
}>({
  language: "en",
  setLanguage: () => {},
  t: (key) => key,
  getLanguageDisplayName: (lang) => lang,
});

/**
 * Hook personalizado para consumir el contexto de idioma UI.
 * Lanza un error si se usa fuera del proveedor.
 */
export function useUILanguage() {
  const context = useContext(UILanguageContext);
  if (context === undefined) {
    throw new Error("useUILanguage must be used within a UILanguageProvider");
  }
  return context;
}

/**
 * Proveedor de idioma UI que persiste la selección en localStorage.
 */
export function UILanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<string>(() => {
    // Intentar leer de localStorage, fallback a inglés
    const saved = window.localStorage.getItem("uiLanguage");
    if (saved && SUPPORTED_UI_LANGUAGES.includes(saved as any)) {
      return saved;
    }
    return "en";
  });

  // Guardar en localStorage cada vez que cambie el idioma
  useEffect(() => {
    window.localStorage.setItem("uiLanguage", language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  const setLanguage = (lang: string) => {
    if (SUPPORTED_UI_LANGUAGES.includes(lang as any)) {
      setLanguageState(lang);
    }
  };

  // Función de traducción conveniente
  const t = (key: string) => translateUI(key as any, language);

  return (
    <UILanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        getLanguageDisplayName: getUILanguageDisplayName,
      }}
    >
      {children}
    </UILanguageContext.Provider>
  );
}