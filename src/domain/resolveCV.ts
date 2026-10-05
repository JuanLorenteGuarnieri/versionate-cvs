import type { AppDatabase, FieldType, FieldValue, Template } from "./model/types.js";

export interface ResolvedField {
  key: string;
  label: string;
  type: FieldType;
  value: FieldValue;
}

export interface ResolvedItem {
  elementId: string;
  variantId: string;
  variantName: string;
  fields: ResolvedField[];
  /** true si el elemento o la variante ya no existen (p. ej. están en la papelera). */
  broken: boolean;
}

export interface ResolvedSection {
  sectionDefinitionId: string;
  /** Key estable de la SectionDefinition ("experience", "languages"...), o
   * "" si la sección de referencia ya no existe. Permite a la capa de
   * preview aplicar layouts específicos por tipo de sección (idiomas en
   * columnas, skills fusionado...) sin tener que repetir el lookup contra
   * `db.sections` en cada sitio. */
  key: string;
  title: string;
  order: number;
  items: ResolvedItem[];
  /** true si hay al menos un item resoluble (no roto). Ver §8 del contexto. */
  hasVisibleContent: boolean;
}

export interface ResolvedCV {
  cvVersionId: string;
  templateId: string;
  /** null si el template fue borrado/está en la papelera (referencia rota). */
  template: Template | null;
  sections: ResolvedSection[];
}

/**
 * Resuelve una CVVersion contra el estado actual de la base de datos.
 * No filtra nada por sí misma: devuelve TODAS las secciones (incluidas las
 * vacías o con referencias rotas) para que el editor pueda mostrar avisos.
 * Usa `getVisibleSections` para obtener lo que realmente debe imprimirse/
 * mostrarse en la preview final.
 */
export function resolveCV(db: AppDatabase, cvVersionId: string): ResolvedCV {
  const version = db.cvVersions.find((v) => v.id === cvVersionId);
  if (!version) {
    throw new Error(`CVVersion not found: ${cvVersionId}`);
  }
  const template = db.templates.find((t) => t.id === version.templateId) ?? null;

  const sections: ResolvedSection[] = [...version.sections]
    .sort((a, b) => a.order - b.order)
    .map((sectionInstance) => {
      const sectionDef = db.sections.find((s) => s.id === sectionInstance.sectionDefinitionId);
      const title =
        sectionInstance.titleOverride ?? sectionDef?.defaultTitle ?? sectionInstance.sectionDefinitionId;

      const items: ResolvedItem[] = [...sectionInstance.items]
        .sort((a, b) => a.order - b.order)
        .map((item) => {
          const element = db.elements.find((e) => e.id === item.elementId);
          const variant = db.variants.find(
            (v) => v.id === item.variantId && v.elementId === item.elementId
          );

          if (!element || !variant || !sectionDef) {
            return {
              elementId: item.elementId,
              variantId: item.variantId,
              variantName: variant?.name ?? "(referencia eliminada)",
              fields: [],
              broken: true,
            };
          }

          const fields: ResolvedField[] = sectionDef.fieldSchema.map((fieldDef) => ({
            key: fieldDef.key,
            label: fieldDef.label,
            type: fieldDef.type,
            value: variant.fields[fieldDef.key] ?? null,
          }));

          return {
            elementId: item.elementId,
            variantId: item.variantId,
            variantName: variant.name,
            fields,
            broken: false,
          };
        });

      return {
        sectionDefinitionId: sectionInstance.sectionDefinitionId,
        key: sectionDef?.key ?? "",
        title,
        order: sectionInstance.order,
        items,
        hasVisibleContent: items.some((i) => !i.broken),
      };
    });

  return { cvVersionId: version.id, templateId: version.templateId, template, sections };
}

/**
 * Filtra a las secciones que realmente deben renderizarse en la preview final
 * y en el PDF: sin secciones vacías, sin items con referencias rotas
 * (ARCHITECTURE.md §7-8). El editor, en cambio, puede usar `resolveCV`
 * directamente para mostrar avisos sobre referencias rotas.
 */
export function getVisibleSections(resolved: ResolvedCV): ResolvedSection[] {
  return resolved.sections
    .filter((s) => s.hasVisibleContent)
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.broken) }));
}
