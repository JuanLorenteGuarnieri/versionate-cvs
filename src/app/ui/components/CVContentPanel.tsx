import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { AppStore } from "../../state/appStore.js";
import type { AppDatabase, CVVersion } from "../../../domain/model/types.js";
import { SUPPORTED_DISPLAY_LANGUAGES } from "../../../domain/i18n.js";
import { moveItem } from "../../state/arrayReorder.js";
import { SectionComposer } from "./SectionComposer.js";
import { SortableRow } from "./SortableRow.js";

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Español",
  en: "English",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  it: "Italiano",
};

/**
 * Solo las secciones que YA tienen contenido en este CV son reordenables:
 * una sección vacía no aparece en el CV renderizado (§8 del contexto), así
 * que no tiene sentido darle una posición. En cuanto se marca el primer
 * elemento de una sección "sin usar todavía", pasa a la lista de arriba en
 * el siguiente render (aparece al final).
 */
export function CVContentPanel({ appStore, db, version }: { appStore: AppStore; db: AppDatabase; version: CVVersion }) {
  const sortedSections = [...db.sections].sort((a, b) => a.order - b.order);

  const usedInstances = [...version.sections].filter((s) => s.items.length > 0).sort((a, b) => a.order - b.order);
  const usedIds = usedInstances.map((s) => s.sectionDefinitionId);
  const usedSections = usedIds
    .map((id) => sortedSections.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const unusedSections = sortedSections.filter(
    (s) => !usedIds.includes(s.id) && db.elements.some((e) => e.sectionId === s.id)
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = usedIds.indexOf(String(active.id));
    const toIndex = usedIds.indexOf(String(over.id));
    if (fromIndex === -1 || toIndex === -1) return;
    appStore.reorderCvSections(version.id, moveItem(usedIds, fromIndex, toIndex));
  }

  return (
    <div className="cv-content-panel">
      <label className="cv-content-panel__language entity-form__field">
        <span>Idioma de visualización</span>
        <select
          value={version.displayLanguage ?? "en"}
          onChange={(e) => appStore.setCvDisplayLanguage(version.id, e.target.value)}
        >
          {SUPPORTED_DISPLAY_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {LANGUAGE_NAMES[lang] ?? lang}
            </option>
          ))}
        </select>
        <span className="cv-content-panel__language-hint">
          Cambia el idioma de las fechas y de los títulos de sección/etiquetas que sigan en su
          valor por defecto — el contenido que ya hayas escrito o renombrado a mano no se toca.
        </span>
      </label>

      {usedSections.length === 0 ? (
        <p className="empty-state">
          Todavía no hay contenido en este CV. Añade algo desde "Sin usar todavía", más abajo.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
          <SortableContext items={usedIds} strategy={verticalListSortingStrategy}>
            <div className="cv-content-panel__sections">
              {usedSections.map((section) => (
                <SortableRow key={section.id} id={section.id}>
                  {(handle) => (
                    <SectionComposer appStore={appStore} db={db} version={version} section={section} dragHandle={handle} />
                  )}
                </SortableRow>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {unusedSections.length > 0 && (
        <>
          <h3 className="cv-content-panel__heading">Sin usar todavía</h3>
          <div className="cv-content-panel__unused">
            {unusedSections.map((section) => (
              <SectionComposer key={section.id} appStore={appStore} db={db} version={version} section={section} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
