import { useUILanguage } from "../UILanguageContext.js";
import type { AppDatabase } from "../../../domain/model/types.js";
import { formatTimestampForDisplay } from "../../../domain/formatting.js";
import { ScreenHeader } from "./ScreenHeader.js";

/**
 * Fase 11 del plan (historial visible en UI, §16 del contexto). Solo
 * lectura a propósito: el historial es para entender qué ha pasado y
 * ayudar a depurar, no un panel de control con acciones.
 */
export function HistoryScreen({ db, onBack }: { db: AppDatabase; onBack: () => void }) {
  const { t } = useUILanguage();
  const entries = [...db.history].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <main className="history-screen">
      <ScreenHeader title={t("historyTitle")} onBack={onBack} />

      {entries.length === 0 ? (
        <p className="empty-state">{t("historyEmpty")}</p>
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
