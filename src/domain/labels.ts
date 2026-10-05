import type { AppDatabase, Element, Variant } from "./model/types.js";

const PRIORITY_KEYS = ["title", "role", "fullName", "name", "degree"];

/**
 * Versión de bajo nivel de guessElementLabel: trabaja sobre una lista de
 * variantes ya en mano, sin necesitar la AppDatabase completa. Existe para
 * poder describir también snapshots de la papelera (donde el elemento y
 * sus variantes ya no están en `db.variants`, sino embebidos en el propio
 * TrashEntry) sin duplicar la lógica de prioridad de campos — ver
 * `describeTrashEntry` en trash.ts.
 */
export function guessLabelFromVariants(defaultVariantId: string, variants: Variant[]): string {
  const variant = variants.find((v) => v.id === defaultVariantId);
  if (!variant) return "(sin contenido)";
  for (const key of PRIORITY_KEYS) {
    const value = variant.fields[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return variant.name;
}

/**
 * Adivina una etiqueta legible para un elemento a partir de los campos de su
 * variante por defecto (título, rol, nombre...). Existe porque el nombre de
 * una variante es un nombre de VERSIÓN del contenido ("Computer Vision"),
 * no el contenido en sí — no sirve para identificar DE QUÉ trata el
 * elemento en una lista (p. ej. qué proyecto es).
 *
 * Si el usuario ha puesto un nombre explícito (`element.labelOverride`,
 * ver `renameElement` en variants.ts — petición explícita: poder
 * renombrar el nombre que identifica al elemento en los selectores, sin
 * que dependa de si el campo de título de la variante por defecto
 * coincide con lo que se quiere ver ahí), ese nombre gana siempre sobre
 * cualquier adivinanza.
 */
export function guessElementLabel(element: Element, db: AppDatabase): string {
  if (element.labelOverride && element.labelOverride.trim()) return element.labelOverride;
  return guessLabelFromVariants(element.defaultVariantId, db.variants);
}
