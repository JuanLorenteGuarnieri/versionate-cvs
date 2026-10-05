import type { AppDatabase } from "../domain/model/types.js";
import type { Store } from "./store.js";

/**
 * Implementación en memoria de `Store`. Se pierde al recargar la página, así
 * que NUNCA es la implementación real de la app — sirve para tests unitarios
 * de todo lo que dependa de un `Store` (autosave, etc.) sin tocar IndexedDB.
 */
export function createMemoryStore(initial: AppDatabase | null = null): Store {
  let current: AppDatabase | null = initial;
  return {
    async load() {
      return current;
    },
    async save(db) {
      current = db;
    },
    async clear() {
      current = null;
    },
  };
}
