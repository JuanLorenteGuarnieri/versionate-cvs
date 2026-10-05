import type { AppDatabase } from "../../../domain/model/types.js";
import { formatTimestampForDisplay } from "../../../domain/formatting.js";

/**
 * Fase 11 del plan (historial visible en UI, §16 del contexto). Solo
 * lectura a propósito: el historial es para entender qué ha pasado y
 * ayudar a depurar, no un panel de control con acciones.
 */
export function HistoryScreen({ db, onBack }: { db: AppDatabase; onBack: () => void }) {
  const entries = [...db.history].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <main className="history-screen">
      <button className="link-button" onClick={onBack}>
        ← Volver
      </button>
      <h1>Historial</h1>

      {entries.length === 0 ? (
        <p className="empty-state">Todavía no hay ningún cambio registrado.</p>
      ) : (
        <ul className="history-list">
          {entries.map((entry) => (
            <li key={entry.id} className="history-list__item">
              <span className="history-list__time">{formatTimestampForDisplay(entry.timestamp)}</span>
              <span>{entry.summary}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
