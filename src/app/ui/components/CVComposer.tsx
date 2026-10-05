import { useState, type CSSProperties } from "react";
import type { AppStore } from "../../state/appStore.js";
import type { AppDatabase, CVProject } from "../../../domain/model/types.js";
import { suggestNextLabel } from "../../../domain/cv.js";
import { suggestCvPdfFilename } from "../downloadFile.js";
import { CVContentPanel } from "./CVContentPanel.js";
import { CVPreview } from "./CVPreview.js";
import { PreviewViewport } from "./PreviewViewport.js";
import { sortAlpha } from "../sortAlpha.js";
import { useHeightDerivedWidth } from "../useHeightDerivedWidth.js";

/**
 * Fase 6 del plan: editor estilo Overleaf. Izquierda = formularios de
 * contenido (con drag-and-drop), derecha = preview en tiempo real — ambos
 * leen del mismo `db`, así que cualquier cambio en la izquierda se refleja
 * de inmediato en la derecha sin ningún paso intermedio (§11 del contexto).
 *
 * Fase 7: selector de template + atajo para editarla (`onEditTemplate` se
 * lo pide a Dashboard, que controla la navegación).
 *
 * Fase 9: versionado. "Guardar como nueva versión" bifurca la versión
 * activa (§9 del contexto: se pide un nombre con una sugerencia editable,
 * nunca se crea en silencio); el selector permite volver a cargar una
 * versión anterior para seguir editándola, y se puede enviar a la papelera
 * cualquier versión salvo la última que quede.
 *
 * Fase 12: atajo "Analizar ATS" para esta versión concreta (`onAnalyzeAts`
 * se lo pide a Dashboard, igual que `onEditTemplate`).
 */
export function CVComposer({
  appStore,
  db,
  cvProject,
  onBack,
  onEditTemplate,
  onAnalyzeAts,
}: {
  appStore: AppStore;
  db: AppDatabase;
  cvProject: CVProject;
  onBack: () => void;
  onEditTemplate: (templateId: string, contextCvVersionId?: string) => void;
  onAnalyzeAts: (cvVersionId: string) => void;
}) {
  const version = db.cvVersions.find((v) => v.id === cvProject.activeVersionId);
  const { ref: panelRightRef, width: panelRightWidth } = useHeightDerivedWidth<HTMLDivElement>();
  const template = version ? db.templates.find((t) => t.id === version.templateId) : undefined;
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function handleCreateVersion() {
    const suggested = version ? suggestNextLabel(version.label) : "v2";
    const label = window.prompt("Nombre para la nueva versión:", suggested);
    if (!label) return;
    appStore.createNewCVVersion(cvProject.id, label);
  }

  /**
   * Los cambios de contenido (añadir/quitar/mover elementos, cambiar de
   * variante...) ya se autoguardan solos (§12 del contexto) — este botón no
   * hace nada distinto por debajo, pero fuerza el guardado YA en vez de
   * esperar al debounce y da una confirmación explícita en pantalla, que es
   * lo que se echaba en falta al lado de "Guardar como nueva versión".
   */
  async function handleSaveNow() {
    setSaveState("saving");
    try {
      await appStore.autosave.flushNow();
      setSaveState("saved");
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1800);
    } catch (err) {
      console.error("No se pudo guardar:", err);
      setSaveState("error");
    }
  }

  function handleDeleteVersion() {
    if (!version) return;
    if (cvProject.versionIds.length <= 1) {
      window.alert("No puedes eliminar la única versión de un CV. Elimina el CV completo en su lugar.");
      return;
    }
    if (!window.confirm(`¿Enviar la versión "${version.label}" a la papelera?`)) return;
    appStore.trashCvVersion(version.id);
  }

  /** Antes no había ninguna forma de cambiar el nombre de un CV tras crearlo. */
  function handleRename() {
    const name = window.prompt("Nuevo nombre para este CV:", cvProject.name);
    if (!name) return;
    try {
      appStore.renameCvProject(cvProject.id, name);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    }
  }

  /** Igual que handleRename, pero para el label de la VERSIÓN ("v1", "v2"...), no del CV entero. */
  function handleRenameVersion() {
    if (!version) return;
    const label = window.prompt("Nuevo nombre para esta versión:", version.label);
    if (!label) return;
    try {
      appStore.renameCvVersion(version.id, label);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * `window.print()` sugiere como nombre de archivo el `document.title`
   * actual en el momento de llamarlo — y ese título es fijo
   * ("Create Versionate CVs") en toda la SPA, así que sin este truco el PDF
   * siempre se ofrece para descargar con el mismo nombre genérico en vez
   * del nombre del CV. Se restaura el título original al terminar (evento
   * "afterprint", con un timeout de seguridad por si el navegador no lo
   * dispara).
   */
  function handleExportPdf() {
    const previousTitle = document.title;
    document.title = suggestCvPdfFilename(cvProject.name);
    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      document.title = previousTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    setTimeout(restore, 5000);
    window.print();
  }

  return (
    <div className="cv-composer">
      <div className="cv-composer__toolbar">
        <button className="link-button" onClick={onBack}>
          ← Todos los CVs
        </button>
        <h1>{cvProject.name}</h1>
        <button
          className="link-button cv-composer__rename-button"
          onClick={handleRename}
          title="Cambiar el nombre de este CV"
          aria-label="Cambiar el nombre de este CV"
        >
          ✎
        </button>

        {version && (
          <div className="cv-composer__controls">
            <label className="cv-composer__control">
              <span>Versión:</span>
              <select
                value={cvProject.activeVersionId}
                onChange={(e) => appStore.setActiveVersion(cvProject.id, e.target.value)}
              >
                {sortAlpha(
                  cvProject.versionIds
                    .map((versionId) => db.cvVersions.find((vv) => vv.id === versionId))
                    .filter((v): v is NonNullable<typeof v> => Boolean(v)),
                  (v) => v.label
                ).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="link-button" onClick={handleRenameVersion} title="Cambiar el nombre de esta versión">
              ✎
            </button>
            <button className="link-button" onClick={handleSaveNow} disabled={saveState === "saving"}>
              {saveState === "saving" ? "Guardando…" : saveState === "saved" ? "Guardado ✓" : "Guardar"}
            </button>
            <button className="link-button" onClick={handleCreateVersion}>
              Guardar como nueva versión
            </button>
            <button className="link-button link-button--danger" onClick={handleDeleteVersion}>
              Eliminar esta versión
            </button>

            <label className="cv-composer__control">
              <span>Template:</span>
              <select
                value={version.templateId}
                onChange={(e) => appStore.setCvTemplate(version.id, e.target.value)}
              >
                {db.templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            {template && (
              <button className="link-button" onClick={() => onEditTemplate(template.id, version.id)}>
                Editar
              </button>
            )}

            <button className="secondary-button" onClick={() => onAnalyzeAts(version.id)}>
              Analizar ATS
            </button>
            <button className="primary-button" onClick={handleExportPdf}>
              Exportar a PDF
            </button>
          </div>
        )}
      </div>

      {!version ? (
        <p className="app-status app-status--error">No se encontró la versión activa de este CV.</p>
      ) : !template ? (
        <p className="app-status app-status--error">
          Esta versión no tiene una template válida (puede que se haya enviado a la papelera).
        </p>
      ) : (
        <div
          className="cv-composer__split"
          style={panelRightWidth !== undefined ? ({ "--panel-right-width": `${panelRightWidth}px` } as CSSProperties) : undefined}
        >
          <div className="cv-composer__panel-left">
            <CVContentPanel appStore={appStore} db={db} version={version} />
          </div>
          <div className="cv-composer__panel-right" ref={panelRightRef}>
            <PreviewViewport>
              <CVPreview db={db} cvVersionId={version.id} />
            </PreviewViewport>
          </div>
        </div>
      )}
    </div>
  );
}
