export interface DirtyTracker {
  markDirty(): void;
  markClean(): void;
  isDirty(): boolean;
}

/** Lleva la cuenta de si hay cambios que aún no se han escrito en el Store. */
export function createDirtyTracker(): DirtyTracker {
  let dirty = false;
  return {
    markDirty() {
      dirty = true;
    },
    markClean() {
      dirty = false;
    },
    isDirty() {
      return dirty;
    },
  };
}

/**
 * Subconjunto de `Window`/`EventTarget` que necesitamos, para poder
 * inyectar un objeto falso en los tests en vez de depender de que exista
 * `window` de verdad (esto no corre en un navegador durante los tests).
 */
export interface BeforeUnloadLikeEvent {
  preventDefault(): void;
  returnValue: string;
}
export interface BeforeUnloadTarget {
  addEventListener(type: "beforeunload", listener: (e: BeforeUnloadLikeEvent) => void): void;
  removeEventListener(type: "beforeunload", listener: (e: BeforeUnloadLikeEvent) => void): void;
}

/**
 * Adjunta el aviso estándar de `beforeunload` del navegador cuando hay
 * cambios sin guardar (§12 del contexto: "el navegador puede controlar el
 * texto exacto del aviso" — por eso no ponemos ningún mensaje custom).
 * Devuelve una función para desengancharlo (útil en tests y en cleanup de UI).
 */
export function attachUnsavedChangesGuard(
  target: BeforeUnloadTarget,
  tracker: DirtyTracker
): () => void {
  function handler(e: BeforeUnloadLikeEvent): void {
    if (tracker.isDirty()) {
      e.preventDefault();
      e.returnValue = "";
    }
  }
  target.addEventListener("beforeunload", handler);
  return () => target.removeEventListener("beforeunload", handler);
}
