import { useState } from "react";
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
import type { AppDatabase, CVVersion, SectionDefinition } from "../../../domain/model/types.js";
import { guessElementLabel } from "../../../domain/labels.js";
import { moveItem } from "../../state/arrayReorder.js";
import { sortAlpha } from "../sortAlpha.js";
import { SortableRow, type DragHandleProps } from "./SortableRow.js";
import { CvItemEditPanel } from "./CvItemEditPanel.js";

/**
 * Composer de una sección dentro de un CV. `dragHandle` es opcional: cuando
 * CVContentPanel envuelve esto en su propia SortableRow (para reordenar
 * secciones enteras), pasa el handle de la sección aquí para que se pinte
 * en la cabecera; las secciones "sin usar todavía" se renderizan sin él,
 * porque no tiene sentido arrastrar algo que no está en el CV.
 */
export function SectionComposer({
  appStore,
  db,
  version,
  section,
  dragHandle,
}: {
  appStore: AppStore;
  db: AppDatabase;
  version: CVVersion;
  section: SectionDefinition;
  dragHandle?: DragHandleProps;
}) {
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const elements = db.elements.filter((e) => e.sectionId === section.id);
  if (elements.length === 0) {
    // No tiene sentido ofrecer una sección de la base de datos que todavía
    // no tiene ningún elemento: no habría nada que marcar.
    return null;
  }

  const instance = version.sections.find((s) => s.sectionDefinitionId === section.id);
  const currentItems = instance?.items ?? [];
  const includedIds = new Set(currentItems.map((i) => i.elementId));
  const availableElements = elements.filter((e) => !includedIds.has(e.id));

  function commitItems(nextItems: Array<{ elementId: string; variantId: string }>) {
    appStore.setSectionItems(version.id, section.id, nextItems);
  }

  function handleItemDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = currentItems.map((i) => i.elementId);
    const fromIndex = ids.indexOf(String(active.id));
    const toIndex = ids.indexOf(String(over.id));
    if (fromIndex === -1 || toIndex === -1) return;
    commitItems(moveItem(currentItems, fromIndex, toIndex).map((i) => ({ elementId: i.elementId, variantId: i.variantId })));
  }

  function addElement(elementId: string, defaultVariantId: string) {
    commitItems([
      ...currentItems.map((i) => ({ elementId: i.elementId, variantId: i.variantId })),
      { elementId, variantId: defaultVariantId },
    ]);
  }

  function removeElement(elementId: string) {
    commitItems(
      currentItems.filter((i) => i.elementId !== elementId).map((i) => ({ elementId: i.elementId, variantId: i.variantId }))
    );
  }

  function changeVariant(elementId: string, variantId: string) {
    commitItems(
      currentItems.map((i) => (i.elementId === elementId ? { elementId, variantId } : { elementId: i.elementId, variantId: i.variantId }))
    );
  }

  /**
   * Elimina el ELEMENTO de la base de datos (papelera), a diferencia de
   * "Quitar" (que solo lo saca de este CV). §15 del contexto: avisar antes
   * si algo lo está usando, nunca borrar en silencio.
   */
  function handleDeleteElement(elementId: string, label: string) {
    const referencedByCvVersionIds = appStore.findReferences("element", elementId);
    if (referencedByCvVersionIds.length > 0) {
      const proceed = window.confirm(
        `"${label}" se usa en ${referencedByCvVersionIds.length} versión(es) de CV (incluida esta). ` +
          "Si continúas, esas versiones quedarán con una referencia rota hasta que lo restaures. " +
          "¿Enviar a la papelera de todas formas?"
      );
      if (!proceed) return;
    } else if (!window.confirm(`¿Enviar "${label}" a la papelera?`)) {
      return;
    }
    setEditingElementId(null);
    appStore.trashElement(elementId);
  }

  return (
    <section className="section-composer">
      <header className="section-composer__header">
        {dragHandle && (
          <button
            className="drag-handle"
            {...dragHandle.attributes}
            {...dragHandle.listeners}
            aria-label={`Reordenar sección ${section.defaultTitle}`}
          >
            ⠿
          </button>
        )}
        <h2>{section.defaultTitle}</h2>
      </header>

      {currentItems.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
          <SortableContext items={currentItems.map((i) => i.elementId)} strategy={verticalListSortingStrategy}>
            <ul className="section-composer__included-list">
              {currentItems.map((item) => {
                const element = db.elements.find((e) => e.id === item.elementId);
                if (!element) return null; // referencia rota: no debería pasar, pero no reventamos el render
                const variants = sortAlpha(
                  element.variantIds
                    .map((id) => db.variants.find((v) => v.id === id))
                    .filter((v): v is NonNullable<typeof v> => Boolean(v)),
                  (v) => v.name
                );

                return (
                  <SortableRow key={element.id} id={element.id}>
                    {(handle) => (
                      <li className="section-composer__item-row">
                        <div className="section-composer__item-row-main">
                          <button
                            className="drag-handle"
                            {...handle.attributes}
                            {...handle.listeners}
                            aria-label={`Reordenar ${guessElementLabel(element, db)}`}
                          >
                            ⠿
                          </button>
                          <span className="section-composer__item-label">{guessElementLabel(element, db)}</span>
                          {variants.length > 1 && (
                            <select value={item.variantId} onChange={(e) => changeVariant(element.id, e.target.value)}>
                              {variants.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.name}
                                </option>
                              ))}
                            </select>
                          )}
                          <button
                            className="link-button"
                            onClick={() => setEditingElementId(editingElementId === element.id ? null : element.id)}
                          >
                            {editingElementId === element.id ? "Cerrar" : "Editar"}
                          </button>
                          <button
                            className="link-button link-button--danger"
                            onClick={() => handleDeleteElement(element.id, guessElementLabel(element, db))}
                          >
                            Eliminar
                          </button>
                          <button className="link-button link-button--danger" onClick={() => removeElement(element.id)}>
                            Quitar
                          </button>
                        </div>
                        {editingElementId === element.id &&
                          (() => {
                            const editingVariant = variants.find((v) => v.id === item.variantId);
                            if (!editingVariant) return null;
                            return (
                              <CvItemEditPanel
                                key={editingVariant.id}
                                appStore={appStore}
                                fieldSchema={section.fieldSchema}
                                variant={editingVariant}
                                elementLabel={guessElementLabel(element, db)}
                                otherVariants={variants.filter((v) => v.id !== editingVariant.id)}
                                onVariantForked={(newVariantId) => changeVariant(element.id, newVariantId)}
                                onVariantDeleted={(fallbackVariantId) => {
                                  setEditingElementId(null);
                                  // Si quedaba otra variante, este item pasa
                                  // a usarla. Si no (se borró el elemento
                                  // entero en cascada, ver trash.ts), no hay
                                  // nada más que hacer aquí: el elemento ya
                                  // no aparecerá en `elements` en el próximo
                                  // render y esta fila se deja de pintar
                                  // (misma situación que "Eliminar" arriba).
                                  if (fallbackVariantId) changeVariant(element.id, fallbackVariantId);
                                }}
                                onDone={() => setEditingElementId(null)}
                              />
                            );
                          })()}
                      </li>
                    )}
                  </SortableRow>
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {availableElements.length > 0 && (
        <div className="section-composer__available">
          <p className="section-composer__available-label">Añadir:</p>
          <ul className="section-composer__available-list">
            {availableElements.map((element) => (
              <li key={element.id}>
                <button className="link-button" onClick={() => addElement(element.id, element.defaultVariantId)}>
                  + {guessElementLabel(element, db)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
