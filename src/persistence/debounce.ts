/**
 * Debounce genérico: agrupa llamadas rápidas sucesivas en una sola ejecución
 * de `fn`, `delayMs` después de la última llamada. Se usa para el
 * autoguardado (§12 del contexto: "el estado debe guardarse automáticamente
 * después de las modificaciones", sin depender de que el usuario cierre la
 * pestaña).
 */
export interface Debounced<Args extends unknown[]> {
  /** Programa una ejecución, reiniciando el temporizador si ya había una pendiente. */
  call(...args: Args): void;
  /** Si hay una llamada pendiente, la ejecuta inmediatamente (p. ej. antes de cerrar la pestaña). */
  flush(): void;
  /** Descarta cualquier llamada pendiente sin ejecutarla. */
  cancel(): void;
  /** true si hay una ejecución pendiente sin resolver todavía. */
  isPending(): boolean;
}

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number
): Debounced<Args> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Args | null = null;

  function runPending(): void {
    const args = pendingArgs;
    pendingArgs = null;
    timer = null;
    if (args) fn(...args);
  }

  return {
    call(...args: Args) {
      pendingArgs = args;
      if (timer) clearTimeout(timer);
      timer = setTimeout(runPending, delayMs);
    },
    flush() {
      if (timer) clearTimeout(timer);
      timer = null;
      if (pendingArgs) runPending();
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      pendingArgs = null;
    },
    isPending() {
      return timer !== null;
    },
  };
}
