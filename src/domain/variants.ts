import type { AppDatabase, Element, FieldValue, Variant } from "./model/types.js";
import { createId, nowIso } from "./ids.js";
import { appendHistory } from "./history.js";
import { guessElementLabel } from "./labels.js";

/**
 * Crea un elemento nuevo en una sección junto con su primera variante.
 * La primera variante NO tiene ningún tratamiento especial respecto a las
 * demás (§5 del contexto): es simplemente la primera del array.
 */
export function createElement(
  db: AppDatabase,
  params: { sectionId: string; variantName: string; fields: Record<string, FieldValue> }
): { db: AppDatabase; element: Element; variant: Variant } {
  const timestamp = nowIso();
  const elementId = createId();
  const variant: Variant = {
    id: createId(),
    elementId,
    name: params.variantName,
    derivedFromVariantId: null,
    fields: { ...params.fields },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const element: Element = {
    id: elementId,
    sectionId: params.sectionId,
    variantIds: [variant.id],
    defaultVariantId: variant.id,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  let next: AppDatabase = {
    ...db,
    elements: [...db.elements, element],
    variants: [...db.variants, variant],
  };
  next = appendHistory(next, {
    type: "element_created",
    entityType: "element",
    entityId: element.id,
    summary: `Elemento creado en la sección "${params.sectionId}" con la variante "${variant.name}"`,
  });
  return { db: next, element, variant };
}

function getVariantOrThrow(db: AppDatabase, variantId: string): Variant {
  const variant = db.variants.find((v) => v.id === variantId);
  if (!variant) {
    throw new Error(`Variant not found: ${variantId}`);
  }
  return variant;
}

function getElementOrThrow(db: AppDatabase, elementId: string): Element {
  const element = db.elements.find((e) => e.id === elementId);
  if (!element) {
    throw new Error(`Element not found: ${elementId}`);
  }
  return element;
}

/**
 * Pone (o quita) un nombre explícito para identificar el elemento en
 * listas/selectores (petición explícita del usuario) — a diferencia de
 * `renameVariant`, aquí una cadena vacía SÍ es un valor válido: significa
 * "vuelve a adivinar el nombre automáticamente a partir de la variante por
 * defecto" (ver labels.ts:guessElementLabel), no un error.
 */
export function renameElement(db: AppDatabase, elementId: string, label: string): { db: AppDatabase; element: Element } {
  const existing = getElementOrThrow(db, elementId);
  const trimmed = label.trim();
  const nextLabelOverride = trimmed.length > 0 ? trimmed : undefined;
  if (nextLabelOverride === existing.labelOverride) return { db, element: existing };

  const previousLabel = guessElementLabel(existing, db);
  const updated: Element = { ...existing, labelOverride: nextLabelOverride, updatedAt: nowIso() };
  let next: AppDatabase = {
    ...db,
    elements: db.elements.map((e) => (e.id === elementId ? updated : e)),
  };
  const newLabel = guessElementLabel(updated, next);
  next = appendHistory(next, {
    type: "element_renamed",
    entityType: "element",
    entityId: updated.id,
    summary:
      nextLabelOverride === undefined
        ? `Elemento "${previousLabel}" vuelve al nombre adivinado automáticamente ("${newLabel}")`
        : `Elemento renombrado de "${previousLabel}" a "${newLabel}"`,
  });
  return { db: next, element: updated };
}

/**
 * "Save": actualiza la variante actual in-place.
 */
export function updateVariant(
  db: AppDatabase,
  variantId: string,
  fieldPatch: Record<string, FieldValue>
): { db: AppDatabase; variant: Variant } {
  const existing = getVariantOrThrow(db, variantId);
  const timestamp = nowIso();
  const updated: Variant = {
    ...existing,
    fields: { ...existing.fields, ...fieldPatch },
    updatedAt: timestamp,
  };

  let next: AppDatabase = {
    ...db,
    variants: db.variants.map((v) => (v.id === variantId ? updated : v)),
  };
  next = appendHistory(next, {
    type: "variant_modified",
    entityType: "variant",
    entityId: updated.id,
    summary: `Variante "${updated.name}" modificada`,
  });
  return { db: next, variant: updated };
}

/**
 * "Save as variant": crea una variante nueva derivada de la actual (o de
 * cualquier otra), sin modificar la original. El elemento pasa a incluirla
 * en su lista de variantes, pero no reemplaza ninguna referencia existente
 * desde ningún CV (eso es responsabilidad de quien llame a esta función,
 * ver cv.ts / la UI, según la decisión de §19-B a confirmar en el futuro).
 */
export function forkVariant(
  db: AppDatabase,
  sourceVariantId: string,
  newName: string,
  fieldOverrides: Record<string, FieldValue> = {}
): { db: AppDatabase; variant: Variant } {
  const source = getVariantOrThrow(db, sourceVariantId);
  const timestamp = nowIso();
  const forked: Variant = {
    id: createId(),
    elementId: source.elementId,
    name: newName,
    derivedFromVariantId: source.id,
    fields: { ...source.fields, ...fieldOverrides },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  let next: AppDatabase = {
    ...db,
    variants: [...db.variants, forked],
    elements: db.elements.map((e) =>
      e.id === source.elementId
        ? { ...e, variantIds: [...e.variantIds, forked.id], updatedAt: timestamp }
        : e
    ),
  };
  next = appendHistory(next, {
    type: "variant_forked",
    entityType: "variant",
    entityId: forked.id,
    summary: `Variante "${forked.name}" creada a partir de "${source.name}"`,
  });
  return { db: next, variant: forked };
}

/**
 * Cambia qué variante se muestra por defecto al navegar el elemento.
 * Puramente cosmético/UX, no afecta a ningún CV existente (§18-3).
 */
export function setDefaultVariant(db: AppDatabase, elementId: string, variantId: string): AppDatabase {
  const element = db.elements.find((e) => e.id === elementId);
  if (!element) throw new Error(`Element not found: ${elementId}`);
  if (!element.variantIds.includes(variantId)) {
    throw new Error(`Variant ${variantId} does not belong to element ${elementId}`);
  }
  return {
    ...db,
    elements: db.elements.map((e) =>
      e.id === elementId ? { ...e, defaultVariantId: variantId, updatedAt: nowIso() } : e
    ),
  };
}

/**
 * Cambia el NOMBRE de una variante ya existente (p.ej. "Computer Vision" ->
 * "Computer Vision - Robotics") sin tocar sus campos — antes solo se podía
 * poner un nombre al crearla ("Save as variant"), sin forma de corregirlo
 * después sin tener que volver a bifurcarla.
 */
export function renameVariant(db: AppDatabase, variantId: string, name: string): { db: AppDatabase; variant: Variant } {
  const existing = getVariantOrThrow(db, variantId);
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("El nombre de la variante no puede quedar vacío.");
  }
  if (trimmed === existing.name) return { db, variant: existing };
  const previousName = existing.name;
  const updated: Variant = { ...existing, name: trimmed, updatedAt: nowIso() };
  let next: AppDatabase = {
    ...db,
    variants: db.variants.map((v) => (v.id === variantId ? updated : v)),
  };
  next = appendHistory(next, {
    type: "variant_renamed",
    entityType: "variant",
    entityId: updated.id,
    summary: `Variante renombrada de "${previousName}" a "${trimmed}"`,
  });
  return { db: next, variant: updated };
}
