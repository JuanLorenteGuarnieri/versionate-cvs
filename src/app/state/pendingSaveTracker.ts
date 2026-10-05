import type { AutosaveController } from "../../persistence/autosave.js";
import type { DirtyTracker } from "../../persistence/unsavedChangesGuard.js";

/**
 * Adapta un AutosaveController a la interfaz DirtyTracker que espera
 * `attachUnsavedChangesGuard` (§12 del contexto). Deliberadamente NO lleva
 * su propio booleano: la única fuente de verdad de "hay cambios sin
 * guardar" es si el autosave todavía tiene un guardado pendiente en el
 * debounce (`autosave.hasPendingSave()`). Mantener un booleano aparte
 * podría desincronizarse con la realidad; esto no puede desincronizarse
 * porque no hay dos estados que sincronizar.
 */
export function createPendingSaveTracker(autosave: AutosaveController): DirtyTracker {
  return {
    markDirty() {
      // no-op: el estado real ya lo lleva autosave.hasPendingSave()
    },
    markClean() {
      // no-op, ídem
    },
    isDirty() {
      return autosave.hasPendingSave();
    },
  };
}
