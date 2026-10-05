import type { AppDatabase } from "../model/types.js";
import { getVisibleSections, resolveCV } from "../resolveCV.js";

/**
 * Secciones "estándar" que suele esperarse encontrar en un CV técnico —
 * no es una lista obligatoria (§20 del contexto: la app no impone qué
 * secciones debe tener un CV), es solo la base de la comprobación
 * informativa "¿falta algo habitual?". Deliberadamente no incluye
 * "personal-information" (siempre relevante pero rara vez "olvidada" — si
 * falta, ya hay otros avisos del analizador de estilo para eso) ni
 * secciones más opcionales (publicaciones, voluntariado...).
 */
const EXPECTED_SECTION_KEYS: Array<{ key: string; label: string }> = [
  { key: "experience", label: "Experience" },
  { key: "education", label: "Education" },
  { key: "skills", label: "Skills" },
];

export interface MissingSection {
  key: string;
  label: string;
  /** true si la sección ni siquiera existe en la base de datos (no solo que esté vacía en este CV). */
  sectionMissingFromDatabase: boolean;
}

/**
 * Petición: "detección de secciones estándar ausentes (p.ej. CV técnico
 * sin sección de Skills)" — compara contra las section keys ya definidas
 * en la base de datos y contra el contenido VISIBLE de este CV en
 * concreto (§8 del contexto: una sección sin contenido seleccionado no
 * cuenta como presente, aunque exista la sección en la base de datos).
 */
export function findMissingStandardSections(db: AppDatabase, cvVersionId: string): MissingSection[] {
  const resolved = resolveCV(db, cvVersionId);
  const visibleKeys = new Set(getVisibleSections(resolved).map((s) => s.key));

  const missing: MissingSection[] = [];
  for (const expected of EXPECTED_SECTION_KEYS) {
    if (visibleKeys.has(expected.key)) continue;
    const existsInDatabase = db.sections.some((s) => s.key === expected.key);
    missing.push({ key: expected.key, label: expected.label, sectionMissingFromDatabase: !existsInDatabase });
  }
  return missing;
}
