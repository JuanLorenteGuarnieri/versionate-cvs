import type { AppDatabase } from "../domain/model/types.js";
import { DatabaseValidationError, migrateRawDatabase } from "./migrations.js";

/**
 * Serializa la base de datos a un JSON indentado y legible/editable a mano,
 * tal como exige §14 del contexto ("legible por humanos, razonablemente
 * editable manualmente"). Nunca se minifica.
 */
export function serializeDatabase(db: AppDatabase): string {
  return JSON.stringify(db, null, 2);
}

/**
 * Parsea un backup/export y lo valida y migra al formato actual.
 * Lanza DatabaseValidationError con mensaje humano ante JSON corrupto o con
 * forma inesperada — nunca importa datos a medias silenciosamente.
 */
export function parseDatabase(jsonText: string): AppDatabase {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new DatabaseValidationError("El archivo no contiene JSON válido.");
  }
  return migrateRawDatabase(raw);
}

/**
 * Nombre de fichero sugerido para un backup manual, con timestamp para no
 * pisar backups anteriores. La UI decide cuándo ofrecerlo (botón "Exportar"),
 * esto solo centraliza la convención de nombrado.
 */
export function suggestBackupFilename(date: Date = new Date()): string {
  const iso = date.toISOString().replace(/[:.]/g, "-");
  return `versionate-cvs-backup-${iso}.json`;
}

export { DatabaseValidationError };
