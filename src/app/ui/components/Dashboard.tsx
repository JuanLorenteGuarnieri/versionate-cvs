import { useState, type ChangeEvent } from "react";
import type { AppStore } from "../../state/appStore.js";
import type { AppDatabase } from "../../../domain/model/types.js";
import { suggestBackupFilename } from "../../../persistence/serialization.js";
import { downloadTextFile } from "../downloadFile.js";
import { SectionPanel } from "./SectionPanel.js";
import { CVComposer } from "./CVComposer.js";
import { TemplateEditor } from "./TemplateEditor.js";
import { PdfImportScreen } from "./PdfImportScreen.js";
import { JobMatchScreen } from "./JobMatchScreen.js";
import { TrashScreen } from "./TrashScreen.js";
import { HistoryScreen } from "./HistoryScreen.js";
import { AtsScreen } from "./AtsScreen.js";
import { sortAlpha } from "../sortAlpha.js";

type View =
  | { type: "home" }
  | { type: "section"; sectionId: string }
  | { type: "cv"; projectId: string }
  | { type: "template"; templateId: string; contextCvVersionId?: string; returnTo?: View }
  | { type: "pdf-import" }
  | { type: "job-match" }
  | { type: "trash" }
  | { type: "history" }
  | { type: "ats"; cvVersionId: string; returnTo?: View };

/**
 * Dashboard mínimo (Fases 3-4-7-10-11-12 del plan): CVs, secciones de la
 * base de datos, templates, importación de PDF, papelera, historial,
 * análisis ATS y export/import de la base de datos completa. Sin router:
 * solo estado local, ver ARCHITECTURE.md §2.
 */
export function Dashboard({ appStore, db }: { appStore: AppStore; db: AppDatabase }) {
  const [view, setView] = useState<View>({ type: "home" });

  if (view.type === "section") {
    const section = db.sections.find((s) => s.id === view.sectionId);
    if (section) {
      return (
        <SectionPanel appStore={appStore} db={db} section={section} onBack={() => setView({ type: "home" })} />
      );
    }
  }

  if (view.type === "cv") {
    const project = db.cvProjects.find((p) => p.id === view.projectId);
    if (project) {
      return (
        <CVComposer
          appStore={appStore}
          db={db}
          cvProject={project}
          onBack={() => setView({ type: "home" })}
          onEditTemplate={(templateId, contextCvVersionId) =>
            setView({ type: "template", templateId, contextCvVersionId, returnTo: view })
          }
          onAnalyzeAts={(cvVersionId) => setView({ type: "ats", cvVersionId, returnTo: view })}
        />
      );
    }
  }

  if (view.type === "ats") {
    const versionExists = db.cvVersions.some((v) => v.id === view.cvVersionId);
    if (versionExists) {
      return (
        <AtsScreen
          db={db}
          cvVersionId={view.cvVersionId}
          onBack={() => setView(view.returnTo ?? { type: "home" })}
        />
      );
    }
  }

  if (view.type === "template") {
    const template = db.templates.find((t) => t.id === view.templateId);
    if (template) {
      return (
        <TemplateEditor
          appStore={appStore}
          db={db}
          template={template}
          initialPreviewVersionId={view.contextCvVersionId}
          onBack={() => setView(view.returnTo ?? { type: "home" })}
        />
      );
    }
  }

  if (view.type === "pdf-import") {
    return <PdfImportScreen appStore={appStore} db={db} onBack={() => setView({ type: "home" })} />;
  }

  if (view.type === "job-match") {
    return (
      <JobMatchScreen
        appStore={appStore}
        db={db}
        onBack={() => setView({ type: "home" })}
        onCreated={(projectId) => setView({ type: "cv", projectId })}
      />
    );
  }

  if (view.type === "trash") {
    return <TrashScreen appStore={appStore} db={db} onBack={() => setView({ type: "home" })} />;
  }

  if (view.type === "history") {
    return <HistoryScreen db={db} onBack={() => setView({ type: "home" })} />;
  }

  function handleCreateCv() {
    const name = window.prompt("Nombre para el nuevo CV (por ejemplo, el puesto al que aplica):");
    if (!name) return;
    const { projectId } = appStore.createCVProject({ name });
    setView({ type: "cv", projectId });
  }

  function handleDeleteCv(projectId: string, name: string) {
    if (!window.confirm(`¿Enviar "${name}" a la papelera?`)) return;
    appStore.trashCVProject(projectId);
  }

  function handleCreateTemplate() {
    const name = window.prompt("Nombre para la nueva template:");
    if (!name) return;
    const { templateId } = appStore.createTemplate(name);
    setView({ type: "template", templateId });
  }

  function handleExportJson() {
    downloadTextFile(suggestBackupFilename(), appStore.exportDatabase());
  }

  async function handleImportJsonFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo si hace falta reintentar
    if (!file) return;

    const text = await file.text();
    if (
      !window.confirm(
        "¿Reemplazar TODA tu base de datos actual por el contenido de este archivo? Esta acción no se puede deshacer."
      )
    ) {
      return;
    }
    try {
      appStore.importDatabase(text);
      window.alert("Base de datos importada correctamente.");
    } catch (err) {
      window.alert(`No se pudo importar: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function handleClearHistory() {
    if (!window.confirm("¿Borrar todo el historial de eventos? Esta acción no se puede deshacer.")) return;
    appStore.clearHistory();
  }

  const sortedSections = [...db.sections].sort((a, b) => a.order - b.order);

  return (
    <main className="dashboard">
      <div className="dashboard__topbar">
        <div className="dashboard__utility-links">
          <h1>Create Versionate CVs</h1>
          <button className="link-button" onClick={() => setView({ type: "trash" })}>
            Papelera{db.trash.length > 0 ? ` (${db.trash.length})` : ""}
          </button>
          <button className="link-button" onClick={() => setView({ type: "history" })}>
            Historial
          </button>
          {db.history.length > 0 && (
            <button className="link-button link-button--danger" onClick={handleClearHistory}>
              Borrar historial
            </button>
          )}
          <button className="link-button" onClick={handleExportJson}>
            Exportar JSON
          </button>
          <label className="link-button dashboard__import-label">
            Importar JSON
            <input type="file" accept="application/json" onChange={handleImportJsonFile} hidden />
          </label>
        </div>
      </div>

      <h2 className="dashboard__section-heading dashboard__section-heading--preserve-case">CVs</h2>
      {db.cvProjects.length === 0 ? (
        <p className="empty-state">Todavía no has creado ningún CV.</p>
      ) : (
        <ul className="cv-list">
          {db.cvProjects.map((project) => {
            // Petición explícita: mostrar siempre la PRIMERA versión de la
            // lista (orden alfabético, igual que en el resto de la app —
            // ver sortAlpha.ts) en vez de la versión ACTIVA (la última que
            // se estuvo editando) — son dos conceptos distintos: activa
            // decide qué versión se abre al pulsar en el CV (sin cambios),
            // esto solo decide qué etiqueta de versión se muestra aquí en
            // la lista.
            const versions = sortAlpha(
              project.versionIds
                .map((id) => db.cvVersions.find((v) => v.id === id))
                .filter((v): v is NonNullable<typeof v> => Boolean(v)),
              (v) => v.label
            );
            const version = versions[0];
            return (
              <li key={project.id} className="cv-list__item">
                <button className="cv-list__open" onClick={() => setView({ type: "cv", projectId: project.id })}>
                  <span>{project.name}</span>
                  <span className="cv-list__version">{version?.label}</span>
                </button>
                <button
                  className="link-button link-button--danger"
                  onClick={() => handleDeleteCv(project.id, project.name)}
                >
                  Eliminar
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="dashboard__actions">
        <button className="primary-button" onClick={handleCreateCv}>
          + Nuevo CV
        </button>
        <button className="secondary-button" onClick={() => setView({ type: "job-match" })}>
          Crear CV a partir de una oferta
        </button>
        <button className="secondary-button" onClick={() => setView({ type: "pdf-import" })}>
          Importar CV desde PDF
        </button>
      </div>

      <h2 className="dashboard__section-heading">Templates</h2>
      {db.templates.length === 0 ? (
        <p className="empty-state">Todavía no hay ninguna template (se crea una automáticamente al crear un CV).</p>
      ) : (
        <ul className="cv-list">
          {db.templates.map((template) => (
            <li key={template.id} className="cv-list__item">
              <button
                className="cv-list__open"
                onClick={() => setView({ type: "template", templateId: template.id })}
              >
                <span>{template.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="secondary-button" onClick={handleCreateTemplate}>
        + Nueva template
      </button>

      <h2 className="dashboard__section-heading">Base de datos</h2>
      <ul className="section-list">
        {sortedSections.map((section) => {
          const elementCount = db.elements.filter((e) => e.sectionId === section.id).length;
          return (
            <li key={section.id}>
              <button
                className="section-list__item"
                onClick={() => setView({ type: "section", sectionId: section.id })}
              >
                <span>{section.defaultTitle}</span>
                <span className="section-list__count">{elementCount}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
