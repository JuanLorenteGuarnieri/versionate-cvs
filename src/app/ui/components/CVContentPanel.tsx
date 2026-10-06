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
import { useUILanguage } from "../UILanguageContext.js";

/**
 * Solo las secciones que YA tienen contenido en este CV son reordenables:
 * una sección vacía no aparece en el CV renderizado (§8 del contexto), así
 * que no tiene sentido darle una posición. En cuanto se marca el primer
 * elemento de una sección "sin usar todavía", pasa a la lista de arriba en
 * el siguiente render (aparece al final).
 */
export function CVContentPanel({ appStore, db, version }: { appStore: AppStore; db: AppDatabase; version: CVVersion }) {
  const { t, getLanguageDisplayName } = useUILanguage();
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
        <span>{t("displayLanguageLabel")}</span>
        <select
          value={version.displayLanguage ?? "en"}
          onChange={(e) => appStore.setCvDisplayLanguage(version.id, e.target.value)}
        >
          {SUPPORTED_DISPLAY_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {getLanguageDisplayName(lang)}
            </option>
          ))}
        </select>
        <span className="cv-content-panel__language-hint">
          {t("displayLanguageHint")}
        </span>
      </label>

      {usedSections.length === 0 ? (
        <p className="empty-state">
          {t("noCvContentYet")}
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
          <h3 className="cv-content-panel__heading">{t("unusedYet")}</h3>
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
