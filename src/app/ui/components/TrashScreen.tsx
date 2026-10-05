import type { AppStore } from "../../state/appStore.js";
import type { AppDatabase } from "../../../domain/model/types.js";
import { describeTrashEntry } from "../../../domain/trash.js";
import { formatTimestampForDisplay } from "../../../domain/formatting.js";

/**
 * Fase 11 del plan (papelera visible en UI, §15 del contexto). La lógica
 * de borrado/restauración ya existe y está testeada desde la Fase 1; este
 * componente es solo la vista sobre `db.trash` + los botones que llaman a
 * las acciones del appStore.
 */
export function TrashScreen({ appStore, db, onBack }: { appStore: AppStore; db: AppDatabase; onBack: () => void }) {
  const entries = [...db.trash].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));

  function handleDeleteForever(entryId: string, label: string) {
    if (!window.confirm(`¿Eliminar definitivamente ${label}? No podrás deshacerlo.`)) return;
    appStore.deleteTrashEntry(entryId);
  }

  function handleEmpty() {
    if (!window.confirm(`¿Vaciar la papelera? Se eliminarán definitivamente ${entries.length} elemento(s), sin poder deshacerlo.`)) {
      return;
    }
    appStore.emptyTrash();
  }

  return (
    <main className="trash-screen">
      <button className="link-button" onClick={onBack}>
        ← Volver
      </button>
      <h1>Papelera</h1>

      {entries.length === 0 ? (
        <p className="empty-state">La papelera está vacía.</p>
      ) : (
        <>
          <ul className="trash-list">
            {entries.map((entry) => {
              const label = describeTrashEntry(entry);
              return (
                <li key={entry.id} className="trash-list__item">
                  <div>
                    <strong>{label}</strong>
                    <div className="trash-list__meta">
                      Eliminado el {formatTimestampForDisplay(entry.deletedAt)}
                    </div>
                  </div>
                  <div className="trash-list__actions">
                    <button className="secondary-button" onClick={() => appStore.restore(entry.id)}>
                      Restaurar
                    </button>
                    <button
                      className="link-button link-button--danger"
                      onClick={() => handleDeleteForever(entry.id, label)}
                    >
                      Eliminar definitivamente
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <button className="link-button link-button--danger" onClick={handleEmpty}>
            Vaciar papelera
          </button>
        </>
      )}
    </main>
  );
}
