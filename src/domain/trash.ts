import type {
  AppDatabase,
  CVProject,
  CVVersion,
  Element,
  Template,
  TrashableEntityType,
  TrashEntry,
  Variant,
} from "./model/types.js";
import { createId, nowIso } from "./ids.js";
import { appendHistory } from "./history.js";
import { guessLabelFromVariants } from "./labels.js";

/**
 * Busca qué CVVersions referencian un elemento, variante o template dado.
 * Se calcula al vuelo (no se guardan back-references) para que nunca queden
 * desincronizadas (ARCHITECTURE.md §7). Se usa ANTES de borrar, para poder
 * mostrar el aviso de §15 del contexto.
 */
export function findReferencingCVVersions(
  db: AppDatabase,
  entityType: "element" | "variant" | "template",
  entityId: string
): CVVersion[] {
  if (entityType === "template") {
    return db.cvVersions.filter((v) => v.templateId === entityId);
  }
  return db.cvVersions.filter((v) =>
    v.sections.some((s) =>
      s.items.some((item) =>
        entityType === "element" ? item.elementId === entityId : item.variantId === entityId
      )
    )
  );
}

function addTrashEntry(
  db: AppDatabase,
  entityType: TrashableEntityType,
  entityId: string,
  snapshot: unknown
): AppDatabase {
  const entry: TrashEntry = {
    id: createId(),
    entityType,
    entityId,
    snapshot,
    deletedAt: nowIso(),
  };
  return { ...db, trash: [...db.trash, entry] };
}

/**
 * Envía una variante a la papelera. Si era la última variante de su
 * elemento, el elemento se envía a la papelera en cascada (un elemento sin
 * ninguna variante no tiene sentido en el modelo, §5 del contexto).
 * Los CVs que la referenciaban NO se tocan: quedan con una referencia rota
 * que el resolver debe marcar como tal (ARCHITECTURE.md §7), hasta que se
 * restaure o se quite explícitamente del CV.
 */
export function moveVariantToTrash(db: AppDatabase, variantId: string): AppDatabase {
  const variant = db.variants.find((v) => v.id === variantId);
  if (!variant) throw new Error(`Variant not found: ${variantId}`);
  const element = db.elements.find((e) => e.id === variant.elementId);
  if (!element) throw new Error(`Element not found for variant: ${variantId}`);

  const remainingVariantIds = element.variantIds.filter((id) => id !== variantId);

  if (remainingVariantIds.length === 0) {
    // La variante que se borra es la última del elemento: cascada completa.
    // moveElementToTrash agrupa elemento + variante en UNA sola entrada de
    // papelera (nunca dos entradas separadas para la misma acción de borrado).
    return moveElementToTrash(db, element.id);
  }

  let next: AppDatabase = { ...db, variants: db.variants.filter((v) => v.id !== variantId) };
  next = addTrashEntry(next, "variant", variantId, variant);
  next = appendHistory(next, {
    type: "variant_removed",
    entityType: "variant",
    entityId: variant.id,
    summary: `Variante "${variant.name}" enviada a la papelera`,
  });

  const newDefault =
    element.defaultVariantId === variantId ? remainingVariantIds[0]! : element.defaultVariantId;
  next = {
    ...next,
    elements: next.elements.map((e) =>
      e.id === element.id
        ? { ...e, variantIds: remainingVariantIds, defaultVariantId: newDefault, updatedAt: nowIso() }
        : e
    ),
  };
  return next;
}

/**
 * Envía un elemento y TODAS sus variantes a la papelera como una única
 * unidad restaurable (una sola TrashEntry, nunca una por variante).
 */
export function moveElementToTrash(db: AppDatabase, elementId: string): AppDatabase {
  const element = db.elements.find((e) => e.id === elementId);
  if (!element) throw new Error(`Element not found: ${elementId}`);
  const ownVariants = db.variants.filter((v) => v.elementId === elementId);

  let next: AppDatabase = {
    ...db,
    elements: db.elements.filter((e) => e.id !== elementId),
    variants: db.variants.filter((v) => v.elementId !== elementId),
  };
  next = addTrashEntry(next, "element", elementId, { element, variants: ownVariants });
  return appendHistory(next, {
    type: "element_removed",
    entityType: "element",
    entityId: element.id,
    summary: "Elemento enviado a la papelera",
  });
}

export function moveTemplateToTrash(db: AppDatabase, templateId: string): AppDatabase {
  const template = db.templates.find((t) => t.id === templateId);
  if (!template) throw new Error(`Template not found: ${templateId}`);
  let next: AppDatabase = { ...db, templates: db.templates.filter((t) => t.id !== templateId) };
  next = addTrashEntry(next, "template", templateId, template);
  return appendHistory(next, {
    type: "template_removed",
    entityType: "template",
    entityId: template.id,
    summary: `Template "${template.name}" enviado a la papelera`,
  });
}

export function moveCVProjectToTrash(db: AppDatabase, projectId: string): AppDatabase {
  const project = db.cvProjects.find((p) => p.id === projectId);
  if (!project) throw new Error(`CVProject not found: ${projectId}`);
  const versions = db.cvVersions.filter((v) => v.projectId === projectId);

  let next: AppDatabase = {
    ...db,
    cvProjects: db.cvProjects.filter((p) => p.id !== projectId),
    cvVersions: db.cvVersions.filter((v) => v.projectId !== projectId),
  };
  next = addTrashEntry(next, "cvProject", projectId, { project, versions });
  return appendHistory(next, {
    type: "cv_project_removed",
    entityType: "cvProject",
    entityId: project.id,
    summary: `CV "${project.name}" enviado a la papelera`,
  });
}

/** Envía una única versión antigua a la papelera, conservando el resto del proyecto. */
export function moveCVVersionToTrash(db: AppDatabase, versionId: string): AppDatabase {
  const version = db.cvVersions.find((v) => v.id === versionId);
  if (!version) throw new Error(`CVVersion not found: ${versionId}`);
  const project = db.cvProjects.find((p) => p.id === version.projectId);
  if (!project) throw new Error(`CVProject not found for version: ${versionId}`);
  if (project.versionIds.length <= 1) {
    throw new Error(
      "No se puede enviar a la papelera la única versión de un CV; borra el CV completo en su lugar."
    );
  }

  const remainingVersionIds = project.versionIds.filter((id) => id !== versionId);
  const newActiveId =
    project.activeVersionId === versionId
      ? remainingVersionIds[remainingVersionIds.length - 1]!
      : project.activeVersionId;

  let next: AppDatabase = {
    ...db,
    cvVersions: db.cvVersions.filter((v) => v.id !== versionId),
    cvProjects: db.cvProjects.map((p) =>
      p.id === project.id
        ? { ...p, versionIds: remainingVersionIds, activeVersionId: newActiveId, updatedAt: nowIso() }
        : p
    ),
  };
  next = addTrashEntry(next, "cvVersion", versionId, version);
  return appendHistory(next, {
    type: "cv_version_removed",
    entityType: "cvVersion",
    entityId: version.id,
    summary: `Versión "${version.label}" enviada a la papelera`,
  });
}

/** Restaura cualquier entidad de la papelera a partir de su TrashEntry.id. */
export function restoreFromTrash(db: AppDatabase, trashEntryId: string): AppDatabase {
  const entry = db.trash.find((t) => t.id === trashEntryId);
  if (!entry) throw new Error(`Trash entry not found: ${trashEntryId}`);
  const withoutEntry: AppDatabase = { ...db, trash: db.trash.filter((t) => t.id !== trashEntryId) };

  let next: AppDatabase;
  switch (entry.entityType) {
    case "variant": {
      const variant = entry.snapshot as Variant;
      next = { ...withoutEntry, variants: [...withoutEntry.variants, variant] };
      next = {
        ...next,
        elements: next.elements.map((e) =>
          e.id === variant.elementId && !e.variantIds.includes(variant.id)
            ? { ...e, variantIds: [...e.variantIds, variant.id] }
            : e
        ),
      };
      break;
    }
    case "element": {
      const { element, variants } = entry.snapshot as { element: Element; variants: Variant[] };
      next = {
        ...withoutEntry,
        elements: [...withoutEntry.elements, element],
        variants: [...withoutEntry.variants, ...variants],
      };
      break;
    }
    case "template": {
      const template = entry.snapshot as Template;
      next = { ...withoutEntry, templates: [...withoutEntry.templates, template] };
      break;
    }
    case "cvProject": {
      const { project, versions } = entry.snapshot as { project: CVProject; versions: CVVersion[] };
      next = {
        ...withoutEntry,
        cvProjects: [...withoutEntry.cvProjects, project],
        cvVersions: [...withoutEntry.cvVersions, ...versions],
      };
      break;
    }
    case "cvVersion": {
      const version = entry.snapshot as CVVersion;
      next = {
        ...withoutEntry,
        cvVersions: [...withoutEntry.cvVersions, version],
        cvProjects: withoutEntry.cvProjects.map((p) =>
          p.id === version.projectId && !p.versionIds.includes(version.id)
            ? { ...p, versionIds: [...p.versionIds, version.id] }
            : p
        ),
      };
      break;
    }
    default:
      throw new Error(`Unknown trashable entity type: ${entry.entityType}`);
  }

  return appendHistory(next, {
    type: "entity_restored",
    entityType: entry.entityType,
    entityId: entry.entityId,
    summary: `${entry.entityType} restaurado desde la papelera`,
  });
}

/**
 * Etiqueta legible de un TrashEntry para mostrar en la UI de la papelera,
 * a partir de su propio snapshot (no de `db`: el elemento/variante/etc. ya
 * no está en las colecciones activas). Usa `guessLabelFromVariants` con las
 * variantes EMBEBIDAS en el propio snapshot cuando aplica, en vez de
 * duplicar esa lógica de prioridad de campos.
 */
export function describeTrashEntry(entry: TrashEntry): string {
  switch (entry.entityType) {
    case "variant": {
      const variant = entry.snapshot as Variant;
      return `Variante "${variant.name}"`;
    }
    case "element": {
      const { element, variants } = entry.snapshot as { element: Element; variants: Variant[] };
      return `Elemento "${guessLabelFromVariants(element.defaultVariantId, variants)}"`;
    }
    case "template": {
      const template = entry.snapshot as Template;
      return `Template "${template.name}"`;
    }
    case "cvProject": {
      const { project } = entry.snapshot as { project: CVProject; versions: CVVersion[] };
      return `CV "${project.name}"`;
    }
    case "cvVersion": {
      const version = entry.snapshot as CVVersion;
      return `Versión "${version.label}"`;
    }
    default:
      return "Elemento desconocido";
  }
}

/**
 * Elimina definitivamente una entrada de la papelera. A diferencia de
 * `restoreFromTrash`, esto NO es reversible — la UI debe pedir confirmación
 * explícita antes de llamar a esto (§15 del contexto: "nunca eliminar
 * silenciosamente").
 */
export function deleteTrashEntry(db: AppDatabase, trashEntryId: string): AppDatabase {
  const entry = db.trash.find((t) => t.id === trashEntryId);
  if (!entry) throw new Error(`Trash entry not found: ${trashEntryId}`);
  const next: AppDatabase = { ...db, trash: db.trash.filter((t) => t.id !== trashEntryId) };
  return appendHistory(next, {
    type: "trash_entry_purged",
    entityType: entry.entityType,
    entityId: entry.entityId,
    summary: `${describeTrashEntry(entry)} eliminado definitivamente`,
  });
}

/** Vacía la papelera por completo. Tampoco es reversible. */
export function emptyTrash(db: AppDatabase): AppDatabase {
  if (db.trash.length === 0) return db;
  const count = db.trash.length;
  const next: AppDatabase = { ...db, trash: [] };
  return appendHistory(next, {
    type: "trash_emptied",
    entityType: "trash",
    entityId: "*",
    summary: `Papelera vaciada (${count} elemento(s) eliminados definitivamente)`,
  });
}
