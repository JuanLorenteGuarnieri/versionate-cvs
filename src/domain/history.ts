import type { AppDatabase, HistoryEntry, HistoryEventType } from "./model/types.js";
import { createId, nowIso } from "./ids.js";

/**
 * Devuelve una nueva AppDatabase con una entrada de historial añadida al final.
 * Pura: no muta `db`.
 */
export function appendHistory(
  db: AppDatabase,
  entry: { type: HistoryEventType; entityType: string; entityId: string; summary: string }
): AppDatabase {
  const historyEntry: HistoryEntry = {
    id: createId(),
    timestamp: nowIso(),
    ...entry,
  };
  return { ...db, history: [...db.history, historyEntry] };
}

/**
 * Vacía el historial. Pura: no muta `db`. A diferencia de la papelera
 * (Trash, §15), el historial es solo un registro informativo de eventos
 * (§16: "no es necesario implementar un sistema similar a Git") — borrarlo
 * no afecta a ningún contenido real ni es recuperable, así que la UI debe
 * pedir confirmación antes de llamar a esto.
 */
export function clearHistory(db: AppDatabase): AppDatabase {
  return { ...db, history: [] };
}
