import { useEffect, useMemo } from "react";
import { createAppStore } from "../state/appStore.js";
import { createPendingSaveTracker } from "../state/pendingSaveTracker.js";
import { createIndexedDbStore } from "../../persistence/indexedDbStore.js";
import { attachUnsavedChangesGuard } from "../../persistence/unsavedChangesGuard.js";
import { useAppStore } from "./useAppStore.js";
import { Dashboard } from "./components/Dashboard.js";
import { UILanguageProvider } from "./UILanguageContext.js";
import { LanguageSelector } from "./components/LanguageSelector.js";

export function App() {
  // Una sola instancia por sesión de la pestaña: useMemo con deps [] en vez
  // de useState porque no necesitamos re-renderizar cuando cambie (nunca
  // cambia), solo crearla una vez.
  const appStore = useMemo(() => createAppStore(createIndexedDbStore()), []);
  const state = useAppStore(appStore);

  useEffect(() => {
    void appStore.load();
  }, [appStore]);

  useEffect(() => {
    const tracker = createPendingSaveTracker(appStore.autosave);
    return attachUnsavedChangesGuard(window, tracker);
  }, [appStore]);

  if (state.status === "idle" || state.status === "loading") {
    return (
      <div className="app">
        <div className="app-status">Cargando tu base de datos…</div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="app">
        <div className="app-status app-status--error">
          No se pudo cargar la base de datos: {state.error}
        </div>
      </div>
    );
  }

  return (
    <UILanguageProvider>
      <div className="app">
        <LanguageSelector />
        <Dashboard appStore={appStore} db={state.db!} />
      </div>
    </UILanguageProvider>
  );
}
