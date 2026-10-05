import type { AppDatabase, CVVersion } from "../model/types.js";
import { guessElementLabel } from "../labels.js";

export interface DuplicateElementReport {
  elementId: string;
  /** Títulos de las secciones donde aparece (defaultTitle, en el orden en que se encontraron). */
  sectionTitles: string[];
}

/**
 * Detecta si un mismo elemento se ha añadido a más de una sección de la
 * MISMA versión de CV (§20 del contexto, ejemplo literal: "Scanpath
 * Prediction appears in Projects and Experience"). No es necesariamente un
 * error — a veces tiene sentido reutilizar contenido en dos sitios — pero
 * merece un aviso porque suele ser un despiste.
 */
export function findDuplicateElements(version: CVVersion, db: AppDatabase): DuplicateElementReport[] {
  const sectionIdsByElement = new Map<string, string[]>();

  for (const sectionInstance of version.sections) {
    for (const item of sectionInstance.items) {
      const existing = sectionIdsByElement.get(item.elementId);
      if (existing) {
        if (!existing.includes(sectionInstance.sectionDefinitionId)) {
          existing.push(sectionInstance.sectionDefinitionId);
        }
      } else {
        sectionIdsByElement.set(item.elementId, [sectionInstance.sectionDefinitionId]);
      }
    }
  }

  const duplicates: DuplicateElementReport[] = [];
  for (const [elementId, sectionIds] of sectionIdsByElement) {
    if (sectionIds.length > 1) {
      const sectionTitles = sectionIds.map((id) => db.sections.find((s) => s.id === id)?.defaultTitle ?? id);
      duplicates.push({ elementId, sectionTitles });
    }
  }
  return duplicates;
}

/** Mensaje legible para un duplicado, con el mismo formato que el ejemplo del contexto. */
export function describeDuplicate(duplicate: DuplicateElementReport, db: AppDatabase): string {
  const element = db.elements.find((e) => e.id === duplicate.elementId);
  const label = element ? guessElementLabel(element, db) : duplicate.elementId;
  return `"${label}" aparece en ${duplicate.sectionTitles.join(" y ")}.`;
}
