import type { AppDatabase, FieldDefinition, FieldValue, Template } from "../../domain/model/types.js";
import type { Store } from "../../persistence/store.js";
import { createInitialDatabase } from "../../domain/initialDatabase.js";
import * as databaseDomain from "../../domain/database.js";
import * as variantsDomain from "../../domain/variants.js";
import * as trashDomain from "../../domain/trash.js";
import * as templatesDomain from "../../domain/templates.js";
import * as cvDomain from "../../domain/cv.js";
import { defaultSelectionFromMatch, JOB_DESCRIPTION_NOTES_PREFIX, matchDatabaseToJobDescription } from "../../domain/jobMatching.js";
import { appendHistory, clearHistory } from "../../domain/history.js";
import { createAutosaveController, type AutosaveController } from "../../persistence/autosave.js";
import { parseDatabase, serializeDatabase } from "../../persistence/serialization.js";

export type AppStoreStatus = "idle" | "loading" | "ready" | "error";

export interface AppStoreState {
  status: AppStoreStatus;
  db: AppDatabase | null;
  error: string | null;
}

export type TrashableRefEntityType = "element" | "variant" | "template";

export interface AppStore {
  getState(): AppStoreState;
  subscribe(listener: () => void): () => void;
  load(): Promise<void>;
  readonly autosave: AutosaveController;

  addCustomSection(params: {
    defaultTitle: string;
    fields: Array<Omit<FieldDefinition, "id">>;
  }): { sectionId: string };
  addFieldToSection(sectionId: string, field: Omit<FieldDefinition, "id">): void;
  createElement(params: {
    sectionId: string;
    variantName: string;
    fields: Record<string, FieldValue>;
  }): { elementId: string; variantId: string };
  saveVariant(variantId: string, fieldPatch: Record<string, FieldValue>): void;
  forkVariant(
    sourceVariantId: string,
    newName: string,
    overrides?: Record<string, FieldValue>
  ): { variantId: string };
  /** Cambia el nombre de una variante ya existente, sin tocar sus campos. */
  renameVariant(variantId: string, name: string): void;
  renameElement(elementId: string, label: string): void;
  setDefaultVariant(elementId: string, variantId: string): void;
  /** Consulta de solo lectura: qué versiones de CV usan esto. Para avisar ANTES de borrar (§15). */
  findReferences(entityType: TrashableRefEntityType, entityId: string): string[];
  trashElement(elementId: string): void;
  trashVariant(variantId: string): void;
  restore(trashEntryId: string): void;
  /** Borrado definitivo, sin poder deshacerlo (§15 del contexto). */
  deleteTrashEntry(trashEntryId: string): void;
  emptyTrash(): void;
  /** Vacía el historial de eventos (§16). No afecta a ningún contenido real ni es recuperable. */
  clearHistory(): void;

  // ---- Composición de CV (Fase 4) ----
  /**
   * Crea un CVProject nuevo (con su v1). Si todavía no existe ningún
   * Template en la base de datos, crea uno por defecto automáticamente —
   * todavía no hay UI de gestión de templates (eso es la Fase 7), así que
   * esto evita bloquear la composición de CVs mientras tanto.
   */
  createCVProject(params: { name: string }): { projectId: string; versionId: string };
  /**
   * "Crear CV a partir de una oferta de trabajo" (petición explícita):
   * compara la oferta contra TODA la base de datos y crea un CV nuevo con
   * la selección de contenido resultante ya aplicada — sin crear ninguna
   * variante ni versión de ningún elemento, solo eligiendo entre lo que ya
   * existe. El nombre del CV se adivina a partir de la propia oferta (ver
   * `jobMatching.ts:guessJobTitle`).
   */
  createCvFromJobDescription(jobDescriptionText: string): { projectId: string; versionId: string };
  /**
   * Como `createCvFromJobDescription`, pero con una selección ya elegida
   * de antemano (típicamente por el usuario, tras revisar/ajustar la
   * propuesta automática en `JobMatchScreen.tsx`) en vez de recalcularla
   * desde cero. Secciones con `items: []` se omiten (no crea una sección
   * vacía en el CV).
   */
  createCvFromSelection(params: {
    name: string;
    jobDescriptionText: string;
    sections: Array<{ sectionDefinitionId: string; items: Array<{ elementId: string; variantId: string }> }>;
    /** Idioma detectado de la oferta ("es"/"en"), para fijar el idioma de visualización del CV — ver `ats/languageDetection.ts`. Opcional: si se omite o es `null`, no se toca `displayLanguage`. */
    displayLanguage?: string | null;
  }): { projectId: string; versionId: string };
  setSectionItems(
    cvVersionId: string,
    sectionDefinitionId: string,
    items: Array<{ elementId: string; variantId: string }>
  ): void;
  /** Reordena las secciones de una versión (drag-and-drop, §11 del contexto). */
  reorderCvSections(cvVersionId: string, orderedSectionDefinitionIds: string[]): void;
  trashCVProject(projectId: string): void;

  // ---- Gestión de templates (Fase 7) ----
  createTemplate(name: string): { templateId: string };
  /** "Save": actualiza el template in-place, afecta a todos los CVs que lo usan. */
  updateTemplate(templateId: string, patch: Partial<Omit<Template, "id" | "createdAt">>): void;
  /** "Save as new template": bifurca sin tocar el original (§10 del contexto). */
  forkTemplate(
    sourceTemplateId: string,
    newName: string,
    patch?: Partial<Omit<Template, "id" | "createdAt" | "derivedFromTemplateId">>
  ): { templateId: string };
  setCvTemplate(cvVersionId: string, templateId: string): void;
  trashTemplate(templateId: string): void;

  // ---- Versionado de CVs (Fase 9) ----
  /** "Guardar como nueva versión" (§9 del contexto): bifurca la versión activa, sin tocarla. */
  createNewCVVersion(projectId: string, label?: string): { versionId: string };
  /** Carga una versión anterior para seguir editándola (pasa a ser la activa). */
  setActiveVersion(projectId: string, versionId: string): void;
  /** Cambia el nombre del CV — antes solo se podía poner al crearlo. */
  renameCvProject(projectId: string, name: string): void;
  /** Cambia el label de una versión ("v1", "v2"... o uno propio). */
  renameCvVersion(versionId: string, label: string): void;
  /** Idioma de visualización de esta versión (fechas + traducción de etiquetas de fábrica) — ver i18n.ts. No es un parámetro de template. */
  setCvDisplayLanguage(versionId: string, displayLanguage: string): void;
  trashCvVersion(versionId: string): void;

  // ---- Export/import de la base de datos completa ----
  /** JSON legible, listo para descargar como backup (§14 del contexto). */
  exportDatabase(): string;
  /**
   * Reemplaza TODA la base de datos por el contenido de un JSON exportado
   * previamente. Lanza DatabaseValidationError si el contenido no es
   * válido — la UI debe capturarlo y avisar, nunca importar algo a medias.
   */
  importDatabase(jsonText: string): void;
}

export function createAppStore(store: Store, autosaveDelayMs = 800): AppStore {
  let state: AppStoreState = { status: "idle", db: null, error: null };
  const listeners = new Set<() => void>();
  const autosave = createAutosaveController(store, autosaveDelayMs);

  function setState(next: AppStoreState): void {
    state = next;
    for (const listener of listeners) listener();
  }

  function requireDb(): AppDatabase {
    if (!state.db) {
      throw new Error("AppStore: no se puede modificar la base de datos antes de llamar a load().");
    }
    return state.db;
  }

  /** Todas las mutaciones pasan por aquí: actualiza el estado en memoria y programa el autoguardado. */
  function commit(nextDb: AppDatabase): void {
    setState({ ...state, db: nextDb });
    autosave.scheduleSave(nextDb);
  }

  /** Ver nota en la interfaz AppStore sobre por qué crea un template por defecto. */
  function ensureAtLeastOneTemplate(db: AppDatabase): AppDatabase {
    if (db.templates.length > 0) return db;
    return templatesDomain.createTemplate(db, { name: "Default" }).db;
  }

  /** Lógica compartida entre `createCvFromJobDescription` (selección automática) y `createCvFromSelection` (selección ya revisada/editada a mano por el usuario en JobMatchScreen.tsx) — ver AppStore.createCvFromSelection. */
  function createCvFromSelectionInternal(params: {
    name: string;
    jobDescriptionText: string;
    sections: Array<{ sectionDefinitionId: string; items: Array<{ elementId: string; variantId: string }> }>;
    displayLanguage?: string | null;
  }): { projectId: string; versionId: string } {
    const dbWithTemplate = ensureAtLeastOneTemplate(requireDb());
    const templateId = dbWithTemplate.templates[0]!.id;

    const created = cvDomain.createCVProject(dbWithTemplate, { name: params.name, templateId });
    let next = created.db;
    for (const section of params.sections) {
      if (section.items.length === 0) continue;
      next = cvDomain.setSectionItems(next, created.version.id, section.sectionDefinitionId, section.items);
    }
    next = cvDomain.setCvMetadata(next, created.version.id, {
      notes: `${JOB_DESCRIPTION_NOTES_PREFIX}${params.jobDescriptionText}`,
    });
    // Petición explícita: detectar el idioma de la oferta y fijarlo como
    // idioma de visualización del CV generado (fechas, "Present"/
    // "Actualidad", títulos de sección de fábrica sin renombrar — ver
    // i18n.ts). Si no se detectó idioma con confianza, no se toca (se
    // queda con el comportamiento por defecto de siempre).
    if (params.displayLanguage) {
      next = cvDomain.setCvDisplayLanguage(next, created.version.id, params.displayLanguage);
      // Petición explícita: el nombre de la versión inicial no debe ser el
      // genérico "v1" de siempre, sino reflejar el idioma detectado —
      // "vES"/"vEN" — igual que la convención de nombres de variante que
      // ya usa el resto de la app.
      next = cvDomain.renameCVVersion(next, created.version.id, `v${params.displayLanguage.toUpperCase()}`);
    }

    commit(next);
    return { projectId: created.project.id, versionId: created.version.id };
  }

  return {
    getState() {
      return state;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    autosave,

    async load() {
      setState({ ...state, status: "loading", error: null });
      try {
        const loaded = await store.load();
        if (loaded) {
          setState({ status: "ready", db: loaded, error: null });
          return;
        }
        // Primera ejecución: guardar un CV de ejemplo listo para explorar.
        const fresh = createInitialDatabase();
        await store.save(fresh);
        setState({ status: "ready", db: fresh, error: null });
      } catch (err) {
        setState({ status: "error", db: null, error: err instanceof Error ? err.message : String(err) });
      }
    },

    addCustomSection(params) {
      const { db, section } = databaseDomain.addSectionDefinition(requireDb(), params);
      commit(db);
      return { sectionId: section.id };
    },

    addFieldToSection(sectionId, field) {
      commit(databaseDomain.addFieldToSection(requireDb(), sectionId, field));
    },

    createElement(params) {
      const { db, element, variant } = variantsDomain.createElement(requireDb(), params);
      commit(db);
      return { elementId: element.id, variantId: variant.id };
    },

    saveVariant(variantId, fieldPatch) {
      const { db } = variantsDomain.updateVariant(requireDb(), variantId, fieldPatch);
      commit(db);
    },

    forkVariant(sourceVariantId, newName, overrides = {}) {
      const { db, variant } = variantsDomain.forkVariant(requireDb(), sourceVariantId, newName, overrides);
      commit(db);
      return { variantId: variant.id };
    },

    renameVariant(variantId, name) {
      const { db } = variantsDomain.renameVariant(requireDb(), variantId, name);
      commit(db);
    },

    renameElement(elementId, label) {
      const { db } = variantsDomain.renameElement(requireDb(), elementId, label);
      commit(db);
    },

    setDefaultVariant(elementId, variantId) {
      commit(variantsDomain.setDefaultVariant(requireDb(), elementId, variantId));
    },

    findReferences(entityType, entityId) {
      return trashDomain.findReferencingCVVersions(requireDb(), entityType, entityId).map((v) => v.id);
    },

    trashElement(elementId) {
      commit(trashDomain.moveElementToTrash(requireDb(), elementId));
    },

    trashVariant(variantId) {
      commit(trashDomain.moveVariantToTrash(requireDb(), variantId));
    },

    restore(trashEntryId) {
      commit(trashDomain.restoreFromTrash(requireDb(), trashEntryId));
    },

    deleteTrashEntry(trashEntryId) {
      commit(trashDomain.deleteTrashEntry(requireDb(), trashEntryId));
    },

    emptyTrash() {
      commit(trashDomain.emptyTrash(requireDb()));
    },

    clearHistory() {
      commit(clearHistory(requireDb()));
    },

    createCVProject(params) {
      const dbWithTemplate = ensureAtLeastOneTemplate(requireDb());
      const templateId = dbWithTemplate.templates[0]!.id;
      const result = cvDomain.createCVProject(dbWithTemplate, { name: params.name, templateId });
      commit(result.db);
      return { projectId: result.project.id, versionId: result.version.id };
    },

    createCvFromJobDescription(jobDescriptionText) {
      const match = matchDatabaseToJobDescription(requireDb(), jobDescriptionText);
      return createCvFromSelectionInternal({
        name: match.suggestedName,
        jobDescriptionText,
        sections: defaultSelectionFromMatch(match),
        displayLanguage: match.detectedLanguage,
      });
    },

    createCvFromSelection(params) {
      return createCvFromSelectionInternal(params);
    },

    setSectionItems(cvVersionId, sectionDefinitionId, items) {
      commit(cvDomain.setSectionItems(requireDb(), cvVersionId, sectionDefinitionId, items));
    },

    reorderCvSections(cvVersionId, orderedSectionDefinitionIds) {
      commit(cvDomain.reorderSections(requireDb(), cvVersionId, orderedSectionDefinitionIds));
    },

    trashCVProject(projectId) {
      commit(trashDomain.moveCVProjectToTrash(requireDb(), projectId));
    },

    createTemplate(name) {
      const result = templatesDomain.createTemplate(requireDb(), { name });
      commit(result.db);
      return { templateId: result.template.id };
    },

    updateTemplate(templateId, patch) {
      commit(templatesDomain.updateTemplate(requireDb(), templateId, patch).db);
    },

    forkTemplate(sourceTemplateId, newName, patch = {}) {
      const result = templatesDomain.forkTemplate(requireDb(), sourceTemplateId, newName, patch);
      commit(result.db);
      return { templateId: result.template.id };
    },

    setCvTemplate(cvVersionId, templateId) {
      commit(cvDomain.setCvTemplate(requireDb(), cvVersionId, templateId));
    },

    trashTemplate(templateId) {
      commit(trashDomain.moveTemplateToTrash(requireDb(), templateId));
    },

    createNewCVVersion(projectId, label) {
      const result = cvDomain.createNewCVVersion(requireDb(), projectId, label);
      commit(result.db);
      return { versionId: result.version.id };
    },

    setActiveVersion(projectId, versionId) {
      commit(cvDomain.setActiveVersion(requireDb(), projectId, versionId));
    },

    renameCvProject(projectId, name) {
      commit(cvDomain.renameCVProject(requireDb(), projectId, name));
    },

    renameCvVersion(versionId, label) {
      commit(cvDomain.renameCVVersion(requireDb(), versionId, label));
    },

    setCvDisplayLanguage(versionId, displayLanguage) {
      commit(cvDomain.setCvDisplayLanguage(requireDb(), versionId, displayLanguage));
    },

    trashCvVersion(versionId) {
      commit(trashDomain.moveCVVersionToTrash(requireDb(), versionId));
    },

    exportDatabase() {
      return serializeDatabase(requireDb());
    },

    importDatabase(jsonText) {
      requireDb(); // no se puede importar antes de que exista un estado cargado (evita una carrera con load())
      const parsed = parseDatabase(jsonText); // lanza DatabaseValidationError si no es válido
      const withHistory = appendHistory(parsed, {
        type: "database_imported",
        entityType: "database",
        entityId: "*",
        summary: "Base de datos importada desde un archivo JSON",
      });
      commit(withHistory);
    },
  };
}
