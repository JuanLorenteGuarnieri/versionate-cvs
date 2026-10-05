import type { AppDatabase } from "../domain/model/types.js";

/**
 * Contrato mínimo de persistencia. Deliberadamente pequeño: solo sabe
 * cargar/guardar/limpiar UN registro (la AppDatabase completa), tal como
 * decide ARCHITECTURE.md §13 ("un único registro en un único object store").
 *
 * El export/import a JSON (backups) es un concepto aparte y NO vive aquí:
 * ver `serialization.ts`. Un backup opera sobre un `AppDatabase` en memoria,
 * no sobre el motor de almacenamiento activo, así que no depende de esta
 * interfaz ni de qué implementación de `Store` esté en uso.
 */
export interface Store {
  /** Devuelve la base de datos guardada, o null si no hay nada guardado todavía. */
  load(): Promise<AppDatabase | null>;
  /** Sobrescribe por completo el registro guardado. */
  save(db: AppDatabase): Promise<void>;
  /** Borra el registro guardado (usado por "restaurar backup" antes de importar, o en tests). */
  clear(): Promise<void>;
}
