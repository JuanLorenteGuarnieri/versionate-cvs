import { useState, type ChangeEvent } from "react";
import type { AppStore } from "../../state/appStore.js";
import type { AppDatabase, FieldDefinition, FieldValue, SectionDefinition } from "../../../domain/model/types.js";
import { extractPdfText, setPdfWorkerSrc } from "../../../domain/pdfImport/pdfTextExtraction.js";
import { buildImportDraft, type PdfImportDraft } from "../../../domain/pdfImport/buildDraft.js";
import { mapEntryToFields, type DraftEntry } from "../../../domain/pdfImport/fieldMapping.js";
import { findSimilarElements, type DedupCandidate } from "../../../domain/pdfImport/mapping/dedup.js";
import { FieldInputs } from "./FieldInputs.js";
// Convención de Vite para obtener la URL del asset ya empaquetado, no su
// contenido (ver vite/client.d.ts). El worker de pdf.js es obligatorio en
// el navegador; sin esto, extractPdfText falla con "No
// GlobalWorkerOptions.workerSrc specified". Vive aquí, en la UI, y no en
// src/domain/pdfImport/, para que el dominio siga siendo agnóstico de Vite.
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

setPdfWorkerSrc(pdfWorkerUrl);

/**
 * Schema genérico usado para cualquier sección "nueva" creada desde la
 * importación (cuando la cabecera detectada no coincide con ninguna
 * sección existente). Se comparte entre la vista previa de la revisión
 * (buildEditableEntries/genericNewSectionDefinition) y la creación real
 * (handleImport), para que lo que se ve en pantalla sea exactamente lo que
 * se va a crear.
 */
const GENERIC_NEW_SECTION_FIELDS: Array<Omit<FieldDefinition, "id">> = [
  { key: "title", label: "Título", type: "text", order: 0 },
  { key: "dateRange", label: "Fechas", type: "daterange", order: 1 },
  { key: "description", label: "Descripción", type: "richtext", order: 2 },
];

function genericNewSectionDefinition(name: string): SectionDefinition {
  return {
    id: "new",
    key: "new",
    isCustom: true,
    defaultTitle: name,
    order: 0,
    createdAt: "",
    updatedAt: "",
    fieldSchema: GENERIC_NEW_SECTION_FIELDS.map((f, i) => ({ ...f, id: `tmp-field-${i}` })),
  };
}

interface EditableEntry {
  id: string;
  include: boolean;
  /** La entrada tal y como la detectó el pipeline, sin procesar — se
   * conserva para poder recalcular `fields` si el usuario cambia la
   * sección destino (ver `remapEntries`). */
  rawEntry: DraftEntry;
  /** Valores editables, ya mapeados a las claves del schema de la sección
   * destino actual — esto es lo que se pinta con <FieldInputs>. */
  fields: Record<string, FieldValue>;
  /**
   * Elementos ya existentes en la base de datos que se parecen a esta
   * entrada (§16 del contexto: "nunca eliminar/duplicar silenciosamente" —
   * aquí el equivalente es no CREAR silenciosamente un duplicado). Se
   * calcula una vez al mapear la entrada (a partir del título detectado
   * en ese momento), no en cada pulsación de tecla — si el usuario edita
   * el título a mano después, la sugerencia no se recalcula sola.
   */
  dedupCandidates: DedupCandidate[];
  /** "new" (por defecto) crea un elemento nuevo; un id concreto añade esta entrada como VARIANTE NUEVA de ese elemento ya existente, sin tocar sus otras variantes. */
  dedupChoice: "new" | string;
}

interface EditableSection {
  headingText: string;
  /** id de una sección real, "new" (crear una), o "skip" (no importar). */
  targetSectionId: string | "new" | "skip";
  newSectionName: string;
  entries: EditableEntry[];
}

/** Resuelve a qué SectionDefinition apunta ahora mismo un EditableSection — incluida la "virtual" para el caso "new", usada solo para saber qué campos mostrar en la revisión. */
function resolveTargetSection(section: Pick<EditableSection, "targetSectionId" | "newSectionName" | "headingText">, db: AppDatabase): SectionDefinition | null {
  if (section.targetSectionId === "skip") return null;
  if (section.targetSectionId === "new") {
    return genericNewSectionDefinition(section.newSectionName || section.headingText);
  }
  return db.sections.find((s) => s.id === section.targetSectionId) ?? null;
}

/**
 * Adivina un título representativo de una entrada ya mapeada, mirando el
 * primer campo de tipo texto/url del schema destino — mismo criterio que
 * `mapDraftEntryToFields` usa para decidir qué campo ES el título, para
 * que la comparación de deduplicación compare "lo mismo contra lo mismo".
 */
function guessEntryTitleForDedup(fields: Record<string, FieldValue>, section: SectionDefinition): string {
  const titleField = [...section.fieldSchema].sort((a, b) => a.order - b.order).find((f) => f.type === "text" || f.type === "url");
  const value = titleField ? fields[titleField.key] : undefined;
  return typeof value === "string" ? value : "";
}

function buildEditableEntries(rawEntries: DraftEntry[], targetSection: SectionDefinition | null, db: AppDatabase): EditableEntry[] {
  return rawEntries.map((entry, i) => {
    const fields = targetSection ? mapEntryToFields(entry, targetSection) : {};
    // La deduplicación solo tiene sentido contra una sección REAL ya
    // existente (targetSection.id !== "new"/"skip", ver genericNewSectionDefinition
    // que siempre usa id "new") — una sección todavía por crear no puede
    // tener elementos previos con los que comparar.
    const dedupCandidates =
      targetSection && targetSection.id !== "new" ? findSimilarElements(db, targetSection.id, guessEntryTitleForDedup(fields, targetSection)) : [];
    return {
      id: String(i),
      include: true,
      rawEntry: entry,
      fields,
      dedupCandidates,
      dedupChoice: "new" as const,
    };
  });
}

function buildEditableSections(draft: PdfImportDraft, db: AppDatabase): EditableSection[] {
  return draft.sections.map((section) => {
    const matched = section.matchedSectionKey ? db.sections.find((s) => s.key === section.matchedSectionKey) : undefined;
    const targetSectionId: EditableSection["targetSectionId"] = matched ? matched.id : "new";
    const targetSection = matched ?? genericNewSectionDefinition(section.headingText);
    return {
      headingText: section.headingText,
      targetSectionId,
      newSectionName: section.headingText,
      entries: buildEditableEntries(section.entries, targetSection, db),
    };
  });
}

/**
 * Fase 10 del plan (§19 del contexto). Nada se escribe en la base de datos
 * hasta que el usuario pulsa "Importar lo seleccionado": hasta entonces,
 * todo vive en estado local de este componente, editable campo a campo.
 *
 * Los campos que se muestran por cada entrada son los del SCHEMA REAL de la
 * sección destino (mismo <FieldInputs> que usa el resto de la app para
 * editar variantes) — no una lista fija de título/fechas/descripción: si el
 * destino es "Datos personales", se ven nombre/headline/email/teléfono/
 * ubicación/links; si es "Experience", rol/empresa/fechas/descripción; etc.
 * Cambiar la sección destino en el desplegable recalcula los campos al
 * vuelo (ver remapEntries) — el heurístico de mapeo vive en
 * src/domain/pdfImport/fieldMapping.ts (mapEntryToFields) y tiene tests
 * propios; este componente es solo el "pegamento" que sí requiere un
 * navegador para verificarse (leer el File, mostrar el formulario).
 */
export function PdfImportScreen({
  appStore,
  db,
  onBack,
}: {
  appStore: AppStore;
  db: AppDatabase;
  onBack: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "processing" | "review" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<PdfImportDraft | null>(null);
  const [editableSections, setEditableSections] = useState<EditableSection[]>([]);
  const [createTemplateOption, setCreateTemplateOption] = useState({ enabled: true, name: "Importada de PDF" });

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("processing");
    setErrorMessage(null);
    try {
      const buffer = await file.arrayBuffer();
      const extracted = await extractPdfText(new Uint8Array(buffer));
      const nextDraft = buildImportDraft(extracted);
      setDraft(nextDraft);
      setEditableSections(buildEditableSections(nextDraft, db));
      setStatus("review");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }

  function updateSectionTarget(index: number, targetSectionId: EditableSection["targetSectionId"]) {
    setEditableSections((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const next = { ...s, targetSectionId };
        const targetSection = resolveTargetSection(next, db);
        return { ...next, entries: buildEditableEntries(next.entries.map((e) => e.rawEntry), targetSection, db) };
      })
    );
  }

  function updateSectionNewName(index: number, newSectionName: string) {
    setEditableSections((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const next = { ...s, newSectionName };
        // El nombre no cambia qué campos tiene el schema genérico de "sección
        // nueva", así que no hace falta remapear entradas aquí.
        return next;
      })
    );
  }

  function updateEntryInclude(sectionIndex: number, entryId: string, include: boolean) {
    setEditableSections((prev) =>
      prev.map((s, i) =>
        i === sectionIndex ? { ...s, entries: s.entries.map((e) => (e.id === entryId ? { ...e, include } : e)) } : s
      )
    );
  }

  function updateEntryFields(sectionIndex: number, entryId: string, fields: Record<string, FieldValue>) {
    setEditableSections((prev) =>
      prev.map((s, i) =>
        i === sectionIndex ? { ...s, entries: s.entries.map((e) => (e.id === entryId ? { ...e, fields } : e)) } : s
      )
    );
  }

  function updateEntryDedupChoice(sectionIndex: number, entryId: string, dedupChoice: string) {
    setEditableSections((prev) =>
      prev.map((s, i) =>
        i === sectionIndex ? { ...s, entries: s.entries.map((e) => (e.id === entryId ? { ...e, dedupChoice } : e)) } : s
      )
    );
  }

  function handleImport() {
    for (const section of editableSections) {
      if (section.targetSectionId === "skip") continue;
      const includedEntries = section.entries.filter((e) => e.include);
      if (includedEntries.length === 0) continue;

      let targetSectionId = section.targetSectionId;
      if (targetSectionId === "new") {
        const created = appStore.addCustomSection({
          defaultTitle: section.newSectionName || section.headingText,
          fields: GENERIC_NEW_SECTION_FIELDS,
        });
        targetSectionId = created.sectionId;
      }

      for (const entry of includedEntries) {
        if (entry.dedupChoice !== "new") {
          const existingElement = db.elements.find((el) => el.id === entry.dedupChoice);
          if (existingElement) {
            appStore.forkVariant(existingElement.defaultVariantId, "Importado de PDF", entry.fields);
            continue;
          }
        }
        appStore.createElement({ sectionId: targetSectionId, variantName: "Importado de PDF", fields: entry.fields });
      }
    }

    if (createTemplateOption.enabled && draft) {
      const { templateId } = appStore.createTemplate(createTemplateOption.name || "Importada de PDF");
      const created = appStore.getState().db!.templates.find((t) => t.id === templateId)!;
      appStore.updateTemplate(templateId, {
        typography: {
          ...created.typography,
          baseFontSize: draft.styleProposal.baseFontSize,
          headingScale: draft.styleProposal.headingScale,
        },
        spacing: { ...created.spacing, margins: draft.styleProposal.margins },
      });
    }

    onBack();
  }

  return (
    <main className="pdf-import">
      <button className="link-button" onClick={onBack}>
        ← Volver
      </button>
      <h1>Importar CV desde PDF</h1>
      <p className="pdf-import__subtitle">
        Nada se guarda todavía: revisa y edita lo detectado antes de importarlo.
      </p>

      {status === "idle" && (
        <label className="pdf-import__file-picker">
          <span>Selecciona un PDF</span>
          <input type="file" accept="application/pdf" onChange={handleFileChange} />
        </label>
      )}

      {status === "processing" && <p className="app-status">Leyendo el PDF…</p>}

      {status === "error" && (
        <p className="app-status app-status--error">No se pudo procesar el PDF: {errorMessage}</p>
      )}

      {status === "review" && draft && (
        <>
          {editableSections.length === 0 && (
            <p className="empty-state">No se reconoció ninguna sección en este PDF. Prueba con otro archivo.</p>
          )}

          {editableSections.map((section, sIndex) => {
            const targetSection = resolveTargetSection(section, db);
            return (
              <div key={sIndex} className="pdf-import__section">
                <div className="pdf-import__section-header">
                  <strong>{section.headingText}</strong>
                  <select
                    value={section.targetSectionId}
                    onChange={(e) => updateSectionTarget(sIndex, e.target.value)}
                  >
                    <option value="skip">No importar esta sección</option>
                    <option value="new">Crear sección nueva…</option>
                    {db.sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        → {s.defaultTitle}
                      </option>
                    ))}
                  </select>
                  {section.targetSectionId === "new" && (
                    <input
                      value={section.newSectionName}
                      onChange={(e) => updateSectionNewName(sIndex, e.target.value)}
                      placeholder="Nombre de la sección nueva"
                    />
                  )}
                </div>

                {section.targetSectionId !== "skip" &&
                  targetSection &&
                  section.entries.map((entry) => (
                    <div key={entry.id} className="pdf-import__entry">
                      <label className="pdf-import__entry-checkbox">
                        <input
                          type="checkbox"
                          checked={entry.include}
                          onChange={(e) => updateEntryInclude(sIndex, entry.id, e.target.checked)}
                        />
                        Importar
                      </label>
                      {entry.dedupCandidates.length > 0 && (
                        <label className="pdf-import__dedup">
                          ¿Es lo mismo que algo que ya tienes?{" "}
                          <select
                            value={entry.dedupChoice}
                            onChange={(e) => updateEntryDedupChoice(sIndex, entry.id, e.target.value)}
                          >
                            <option value="new">Crear elemento nuevo</option>
                            {entry.dedupCandidates.map((c) => (
                              <option key={c.elementId} value={c.elementId}>
                                Añadir como variante nueva de "{c.label}" ({Math.round(c.similarity * 100)}% parecido)
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <div className="pdf-import__entry-fields">
                        <FieldInputs
                          fieldSchema={targetSection.fieldSchema}
                          values={entry.fields}
                          onChange={(fields) => updateEntryFields(sIndex, entry.id, fields)}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            );
          })}

          <div className="pdf-import__style">
            <h2 className="template-editor__group-title">Estilo detectado</h2>
            <p className="pdf-import__style-summary">
              Tamaño de texto: {draft.styleProposal.baseFontSize}pt · Escala de títulos:{" "}
              {draft.styleProposal.headingScale}× · Márgenes: {draft.styleProposal.margins.top}/
              {draft.styleProposal.margins.right}/{draft.styleProposal.margins.bottom}/
              {draft.styleProposal.margins.left}mm
            </p>
            <label className="pdf-import__create-template">
              <input
                type="checkbox"
                checked={createTemplateOption.enabled}
                onChange={(e) => setCreateTemplateOption((o) => ({ ...o, enabled: e.target.checked }))}
              />
              Crear una template nueva con este estilo:
              <input
                value={createTemplateOption.name}
                onChange={(e) => setCreateTemplateOption((o) => ({ ...o, name: e.target.value }))}
                disabled={!createTemplateOption.enabled}
              />
            </label>
          </div>

          <div className="entity-form__actions">
            <button className="primary-button" onClick={handleImport}>
              Importar lo seleccionado
            </button>
            <button className="link-button" onClick={onBack}>
              Descartar todo
            </button>
          </div>
        </>
      )}
    </main>
  );
}
