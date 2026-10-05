import type {
  AppDatabase,
  CVProject,
  CVSectionInstance,
  CVSectionItem,
  CVVersion,
} from "./model/types.js";
import { createId, nowIso } from "./ids.js";
import { appendHistory } from "./history.js";

function getProjectOrThrow(db: AppDatabase, projectId: string): CVProject {
  const project = db.cvProjects.find((p) => p.id === projectId);
  if (!project) throw new Error(`CVProject not found: ${projectId}`);
  return project;
}

function getVersionOrThrow(db: AppDatabase, versionId: string): CVVersion {
  const version = db.cvVersions.find((v) => v.id === versionId);
  if (!version) throw new Error(`CVVersion not found: ${versionId}`);
  return version;
}

function cloneSections(sections: CVSectionInstance[]): CVSectionInstance[] {
  return sections.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i })) }));
}

/**
 * Crea un CVProject nuevo junto con su primera versión ("v1"). La primera
 * versión empieza sin secciones activas: el usuario las va añadiendo desde
 * el editor (§11 del contexto).
 */
export function createCVProject(
  db: AppDatabase,
  params: { name: string; templateId: string }
): { db: AppDatabase; project: CVProject; version: CVVersion } {
  const timestamp = nowIso();
  const version: CVVersion = {
    id: createId(),
    projectId: "", // se rellena tras crear el project, ver abajo
    label: "v1",
    templateId: params.templateId,
    sections: [],
    metadata: {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const project: CVProject = {
    id: createId(),
    name: params.name,
    versionIds: [version.id],
    activeVersionId: version.id,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  version.projectId = project.id;

  let next: AppDatabase = {
    ...db,
    cvProjects: [...db.cvProjects, project],
    cvVersions: [...db.cvVersions, version],
  };
  next = appendHistory(next, {
    type: "cv_created",
    entityType: "cvProject",
    entityId: project.id,
    summary: `CV "${project.name}" creado`,
  });
  return { db: next, project, version };
}

/**
 * Cambia el nombre de un CVProject — antes solo se podía poner al crearlo,
 * sin ninguna forma de cambiarlo después (bug real reportado).
 */
export function renameCVProject(db: AppDatabase, projectId: string, name: string): AppDatabase {
  const project = getProjectOrThrow(db, projectId);
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("El nombre del CV no puede quedar vacío.");
  }
  if (trimmed === project.name) return db;
  const previousName = project.name;
  const next: AppDatabase = {
    ...db,
    cvProjects: db.cvProjects.map((p) => (p.id === projectId ? { ...p, name: trimmed, updatedAt: nowIso() } : p)),
  };
  return appendHistory(next, {
    type: "cv_renamed",
    entityType: "cvProject",
    entityId: projectId,
    summary: `CV renombrado de "${previousName}" a "${trimmed}"`,
  });
}

/**
 * "Guardar como nueva versión" (§9 del contexto): clona la versión activa
 * actual del proyecto, la añade al historial de versiones y la convierte en
 * la nueva versión activa. Las versiones anteriores se conservan intactas.
 */
export function createNewCVVersion(
  db: AppDatabase,
  projectId: string,
  label?: string
): { db: AppDatabase; version: CVVersion } {
  const project = getProjectOrThrow(db, projectId);
  const current = getVersionOrThrow(db, project.activeVersionId);
  const timestamp = nowIso();

  const newVersion: CVVersion = {
    ...current,
    id: createId(),
    label: label ?? suggestNextLabel(current.label),
    sections: cloneSections(current.sections),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const updatedProject: CVProject = {
    ...project,
    versionIds: [...project.versionIds, newVersion.id],
    activeVersionId: newVersion.id,
    updatedAt: timestamp,
  };

  let next: AppDatabase = {
    ...db,
    cvVersions: [...db.cvVersions, newVersion],
    cvProjects: db.cvProjects.map((p) => (p.id === projectId ? updatedProject : p)),
  };
  next = appendHistory(next, {
    type: "cv_version_created",
    entityType: "cvVersion",
    entityId: newVersion.id,
    summary: `Versión "${newVersion.label}" creada para "${project.name}"`,
  });
  return { db: next, version: newVersion };
}

/** Sugiere "CV Name_v2" a partir de "v1", como pide §9 del contexto (editable después). */
export function suggestNextLabel(currentLabel: string): string {
  const match = currentLabel.match(/^(.*?)(\d+)$/);
  if (match) {
    const [, prefix, num] = match;
    return `${prefix}${Number(num) + 1}`;
  }
  return `${currentLabel} v2`;
}

function updateVersion(
  db: AppDatabase,
  versionId: string,
  updater: (version: CVVersion) => CVVersion
): AppDatabase {
  return {
    ...db,
    cvVersions: db.cvVersions.map((v) => (v.id === versionId ? updater(v) : v)),
  };
}

/** Se asegura de que una versión tenga una instancia para esa sección (vacía si es nueva). */
function ensureSectionInstance(version: CVVersion, sectionDefinitionId: string): CVVersion {
  if (version.sections.some((s) => s.sectionDefinitionId === sectionDefinitionId)) {
    return version;
  }
  const instance: CVSectionInstance = {
    sectionDefinitionId,
    order: version.sections.length,
    items: [],
  };
  return { ...version, sections: [...version.sections, instance] };
}

/**
 * Reemplaza los elementos/variantes seleccionados para una sección de un CV.
 * Una lista vacía hace que la sección deje de aparecer al renderizar
 * (§8 del contexto: las secciones son dinámicas).
 */
export function setSectionItems(
  db: AppDatabase,
  versionId: string,
  sectionDefinitionId: string,
  items: Array<{ elementId: string; variantId: string }>
): AppDatabase {
  let next = updateVersion(db, versionId, (v) => ensureSectionInstance(v, sectionDefinitionId));
  next = updateVersion(next, versionId, (v) => ({
    ...v,
    updatedAt: nowIso(),
    sections: v.sections.map((s) =>
      s.sectionDefinitionId === sectionDefinitionId
        ? {
            ...s,
            items: items.map(
              (item, index): CVSectionItem => ({ ...item, order: index })
            ),
          }
        : s
    ),
  }));
  return appendHistory(next, {
    type: "cv_section_items_changed",
    entityType: "cvVersion",
    entityId: versionId,
    summary: `Contenido de la sección "${sectionDefinitionId}" actualizado`,
  });
}

/**
 * Reordena las secciones de una versión (drag and drop, §11 del contexto).
 * `orderedSectionDefinitionIds` debe contener exactamente los mismos IDs de
 * sección que ya existen en la versión (aunque estén vacíos).
 */
export function reorderSections(
  db: AppDatabase,
  versionId: string,
  orderedSectionDefinitionIds: string[]
): AppDatabase {
  const version = getVersionOrThrow(db, versionId);
  const existingIds = new Set(version.sections.map((s) => s.sectionDefinitionId));
  const requestedIds = new Set(orderedSectionDefinitionIds);
  if (
    existingIds.size !== requestedIds.size ||
    [...existingIds].some((id) => !requestedIds.has(id))
  ) {
    throw new Error(
      "reorderSections: la lista debe contener exactamente las secciones ya presentes en la versión"
    );
  }

  let next = updateVersion(db, versionId, (v) => ({
    ...v,
    updatedAt: nowIso(),
    sections: v.sections
      .map((s) => ({
        ...s,
        order: orderedSectionDefinitionIds.indexOf(s.sectionDefinitionId),
      }))
      .sort((a, b) => a.order - b.order),
  }));
  return appendHistory(next, {
    type: "cv_section_order_changed",
    entityType: "cvVersion",
    entityId: versionId,
    summary: "Orden de secciones actualizado",
  });
}

/**
 * Selecciona una versión anterior como la activa, para "cargarla
 * completamente para continuar editándola" (§9 del contexto). No modifica
 * la propia versión, solo qué versión del proyecto se considera "la
 * actual" a partir de ahora.
 */
export function setActiveVersion(db: AppDatabase, projectId: string, versionId: string): AppDatabase {
  const project = getProjectOrThrow(db, projectId);
  if (!project.versionIds.includes(versionId)) {
    throw new Error(`La versión ${versionId} no pertenece al proyecto ${projectId}`);
  }
  const next: AppDatabase = {
    ...db,
    cvProjects: db.cvProjects.map((p) =>
      p.id === projectId ? { ...p, activeVersionId: versionId, updatedAt: nowIso() } : p
    ),
  };
  const version = next.cvVersions.find((v) => v.id === versionId)!;
  return appendHistory(next, {
    type: "cv_active_version_changed",
    entityType: "cvProject",
    entityId: projectId,
    summary: `Versión activa cambiada a "${version.label}"`,
  });
}

/**
 * Actualiza los metadatos (rol/empresa objetivo, notas) de una versión de
 * CV. Sin uso en la UI todavía salvo desde `createCvFromJobDescription`
 * (appStore.ts) para dejar constancia de qué oferta de trabajo generó el
 * CV — mezcla sobre lo que ya hubiera (`{...current, ...patch}`), no
 * reemplaza el objeto entero, para no perder otros metadatos si en el
 * futuro se editan por separado.
 */
export function setCvMetadata(db: AppDatabase, versionId: string, patch: Partial<CVVersion["metadata"]>): AppDatabase {
  return updateVersion(db, versionId, (v) => ({ ...v, metadata: { ...v.metadata, ...patch }, updatedAt: nowIso() }));
}

/**
 * Cambia el nombre (label) de una versión — por defecto es "v1", "v2"...
 * pero el usuario debe poder ponerle uno propio (§9 del contexto: "el
 * usuario debe poder cambiarlo").
 */
export function renameCVVersion(db: AppDatabase, versionId: string, label: string): AppDatabase {
  const version = getVersionOrThrow(db, versionId);
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error("El nombre de la versión no puede quedar vacío.");
  }
  if (trimmed === version.label) return db;
  const previousLabel = version.label;
  const next = updateVersion(db, versionId, (v) => ({ ...v, label: trimmed, updatedAt: nowIso() }));
  return appendHistory(next, {
    type: "cv_version_renamed",
    entityType: "cvVersion",
    entityId: versionId,
    summary: `Versión renombrada de "${previousLabel}" a "${trimmed}"`,
  });
}

/**
 * Construye el nombre "hermano" que tendría esta variante en el idioma
 * destino, sustituyendo la aparición de "v<CÓDIGO ORIGEN>" por
 * "v<CÓDIGO DESTINO>" en cualquier parte del nombre — no solo al final ni
 * solo con un prefijo seguido de guion. Cubre tanto "Base - vES" ->
 * "Base - vEN" como el caso de un nombre que sea SOLO "vES" -> "vEN"
 * (petición explícita: "la intención es que [...] sustituya 'ES' por 'EN'
 * y viceversa", en cualquiera de las dos formas). Devuelve `null` si el
 * nombre no contiene ese código en absoluto (nada que sustituir).
 *
 * El código va siempre pegado a una "v" (no busca "ES" suelto en
 * cualquier sitio del nombre) para no disparar con coincidencias
 * casuales dentro de otras palabras del nombre; y usa límites de palabra
 * para no coincidir a mitad de un código más largo (que "vES" no dispare
 * dentro de un futuro "vEST", por ejemplo).
 */
function buildSiblingNameCandidate(currentName: string, sourceCode: string, targetCode: string): string | null {
  const escapedSource = sourceCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\bv${escapedSource}\\b`, "i");
  if (!pattern.test(currentName)) return null;
  return currentName.replace(pattern, (match) => {
    const vChar = match[0];
    const matchedCode = match.slice(1);
    const isUpperCase = matchedCode === matchedCode.toUpperCase();
    return vChar + (isUpperCase ? targetCode.toUpperCase() : targetCode.toLowerCase());
  });
}

/**
 * Busca, para una variante ya seleccionada, una variante HERMANA (mismo
 * elemento) cuyo nombre sea igual al actual salvo por el código de idioma
 * — p.ej. desde "Base - vES" hacia "en" encuentra "Base - vEN", y desde
 * "vES" a secas encuentra "vEN" a secas (ver `buildSiblingNameCandidate`).
 * Devuelve `null` si el nombre actual no contenía el código de origen, o
 * si no existe ninguna variante hermana con el nombre resultante.
 */
function findSiblingVariantForLanguage(
  db: AppDatabase,
  elementId: string,
  currentVariantId: string,
  sourceLangCode: string,
  targetLangCode: string
): string | null {
  if (sourceLangCode.toLowerCase() === targetLangCode.toLowerCase()) return null; // ya está en ese idioma
  const currentVariant = db.variants.find((v) => v.id === currentVariantId);
  if (!currentVariant) return null;
  const candidateName = buildSiblingNameCandidate(currentVariant.name, sourceLangCode, targetLangCode);
  if (!candidateName) return null;

  const element = db.elements.find((e) => e.id === elementId);
  if (!element) return null;
  const sibling = element.variantIds
    .map((id) => db.variants.find((v) => v.id === id))
    .find((v): v is NonNullable<typeof v> => v !== undefined && v.name.toLowerCase() === candidateName.toLowerCase());
  return sibling?.id ?? null;
}

/**
 * Idioma de visualización de esta versión (fechas + traducción de
 * títulos/etiquetas de fábrica sin modificar, ver i18n.ts) — vive en la
 * versión, no en la template, porque una misma template puede reutilizarse
 * para versiones en distintos idiomas.
 *
 * Petición explícita del usuario: al cambiar el idioma, intenta cambiar
 * TAMBIÉN automáticamente la variante seleccionada de cada item del CV a su
 * "hermana" en el idioma nuevo, buscando por nombre (ver
 * `findSiblingVariantForLanguage`) — p.ej. de "Base - vES" a "Base - vEN",
 * o de "vES" a "vEN" a secas. El idioma ORIGEN para esa búsqueda es el que
 * tenía la versión antes de este cambio (`undefined` se trata como "en",
 * igual que en el resto de la app — ver CVContentPanel.tsx). Si no existe
 * una variante con el nombre resultante para un item, ese item se queda
 * tal cual (nunca se rompe una referencia ni se fuerza nada).
 */
export function setCvDisplayLanguage(db: AppDatabase, versionId: string, displayLanguage: string): AppDatabase {
  const version = getVersionOrThrow(db, versionId); // valida que exista antes de tocar nada
  const sourceLangCode = version.displayLanguage ?? "en";
  const newSections = version.sections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      const siblingId = findSiblingVariantForLanguage(
        db,
        item.elementId,
        item.variantId,
        sourceLangCode,
        displayLanguage
      );
      return siblingId ? { ...item, variantId: siblingId } : item;
    }),
  }));
  return updateVersion(db, versionId, (v) => ({
    ...v,
    displayLanguage,
    sections: newSections,
    updatedAt: nowIso(),
  }));
}

/**
 * Cambia el template que usa una versión de CV. Valida que el template
 * exista (evita dejar una referencia rota a propósito, a diferencia de una
 * variante/elemento borrado, que sí puede quedar como referencia rota
 * temporalmente — cambiar de template es una acción explícita del usuario,
 * no algo que deba fallar en silencio ni dejar a medias).
 */
export function setCvTemplate(db: AppDatabase, versionId: string, templateId: string): AppDatabase {
  const template = db.templates.find((t) => t.id === templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }
  const next = updateVersion(db, versionId, (v) => ({ ...v, templateId, updatedAt: nowIso() }));
  return appendHistory(next, {
    type: "cv_template_changed",
    entityType: "cvVersion",
    entityId: versionId,
    summary: `Template cambiado a "${template.name}"`,
  });
}

/**
 * Quita un item concreto de una sección de ESTA versión únicamente (opción
 * "quitar únicamente del CV actual" del flujo de borrado, §15 del contexto).
 * No toca el elemento/variante en la base de datos.
 */
export function removeItemFromSection(
  db: AppDatabase,
  versionId: string,
  sectionDefinitionId: string,
  elementId: string,
  variantId: string
): AppDatabase {
  return updateVersion(db, versionId, (v) => ({
    ...v,
    updatedAt: nowIso(),
    sections: v.sections.map((s) =>
      s.sectionDefinitionId === sectionDefinitionId
        ? {
            ...s,
            items: s.items
              .filter((i) => !(i.elementId === elementId && i.variantId === variantId))
              .map((i, index) => ({ ...i, order: index })),
          }
        : s
    ),
  }));
}
