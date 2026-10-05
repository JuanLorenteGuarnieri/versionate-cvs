import type { AppDatabase } from "../domain/model/types.js";
import type { Store } from "./store.js";

export interface AutosaveController {
  /** Programa un guardado con debounce. Llamar tras cada cambio de estado. */
  scheduleSave(db: AppDatabase): void;
  /** Si hay un guardado pendiente, lo ejecuta ya (p. ej. al cerrar la pestaña). Propaga errores. */
  flushNow(): Promise<void>;
  /** true si hay cambios programados que todavía no se han escrito. */
  hasPendingSave(): boolean;
}

/**
 * Envuelve un `Store` con debounce para no escribir en cada pulsación de
 * teclado, tal como pide §12 del contexto. El guardado real (`store.save`)
 * solo se dispara `delayMs` después de la última llamada a `scheduleSave`.
 *
 * El guardado en segundo plano (disparado por el propio timer) nunca lanza
 * una excepción no controlada si falla: se registra con `console.error` para
 * no ocultarlo silenciosamente, pero no puede "romper" nada porque no hay
 * quien esté esperando esa promesa. `flushNow()`, en cambio, es una acción
 * explícita (p. ej. desde el guard de `beforeunload`) y SÍ propaga el error
 * al que la llama, para que la UI pueda reaccionar si el guardado falla justo
 * antes de cerrar la pestaña.
 */
export function createAutosaveController(store: Store, delayMs = 800): AutosaveController {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingDb: AppDatabase | null = null;

  function runScheduledSave(): void {
    timer = null;
    const db = pendingDb;
    pendingDb = null;
    if (!db) return;
    store.save(db).catch((err: unknown) => {
      console.error("[autosave] Fallo al guardar automáticamente:", err);
    });
  }

  return {
    scheduleSave(db) {
      pendingDb = db;
      if (timer) clearTimeout(timer);
      timer = setTimeout(runScheduledSave, delayMs);
    },
    async flushNow() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const db = pendingDb;
      pendingDb = null;
      if (db) {
        await store.save(db);
      }
    },
    hasPendingSave() {
      return timer !== null;
    },
  };
}

