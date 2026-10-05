import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDatabase } from "../database.js";
import { createTemplate } from "../templates.js";
import { createCVProject, createNewCVVersion, setSectionItems } from "../cv.js";
import { createElement, forkVariant } from "../variants.js";
import {
  deleteTrashEntry,
  describeTrashEntry,
  emptyTrash,
  findReferencingCVVersions,
  moveCVProjectToTrash,
  moveCVVersionToTrash,
  moveElementToTrash,
  moveTemplateToTrash,
  moveVariantToTrash,
  restoreFromTrash,
} from "../trash.js";

function seedProjectWithCV() {
  let db = createEmptyDatabase();
  const templateResult = createTemplate(db, { name: "Minimal Dark" });
  db = templateResult.db;
  const projectsSection = db.sections.find((s) => s.key === "projects")!;
  const elementResult = createElement(db, {
    sectionId: projectsSection.id,
    variantName: "Original",
    fields: { title: "Scanpath Prediction" },
  });
  db = elementResult.db;
  const cvResult = createCVProject(db, { name: "CV", templateId: templateResult.template.id });
  db = setSectionItems(cvResult.db, cvResult.version.id, projectsSection.id, [
    { elementId: elementResult.element.id, variantId: elementResult.variant.id },
  ]);
  return {
    db,
    template: templateResult.template,
    projectsSection,
    element: elementResult.element,
    variant: elementResult.variant,
    cvProject: cvResult.project,
    cvVersion: cvResult.version,
  };
}

test("findReferencingCVVersions detecta un CV que usa una variante o un template", () => {
  const { db, variant, template, cvVersion } = seedProjectWithCV();
  const byVariant = findReferencingCVVersions(db, "variant", variant.id);
  assert.equal(byVariant.length, 1);
  assert.equal(byVariant[0]!.id, cvVersion.id);

  const byTemplate = findReferencingCVVersions(db, "template", template.id);
  assert.equal(byTemplate.length, 1);

  const byNothing = findReferencingCVVersions(db, "variant", "id-inexistente");
  assert.equal(byNothing.length, 0);
});

test("moveVariantToTrash sobre la última variante hace cascada y también trashea el elemento", () => {
  const { db, element, variant } = seedProjectWithCV();
  const next = moveVariantToTrash(db, variant.id);

  assert.equal(next.variants.length, 0);
  assert.equal(next.elements.length, 0);
  assert.equal(next.trash.length, 1, "una sola entrada de papelera para el elemento, con las variantes dentro");
  assert.equal(next.trash[0]!.entityType, "element");
  const snapshot = next.trash[0]!.snapshot as { element: typeof element; variants: (typeof variant)[] };
  assert.equal(snapshot.variants.length, 1);
  assert.equal(snapshot.variants[0]!.id, variant.id);
});

test("moveVariantToTrash sobre una variante no-única conserva el elemento con el resto", () => {
  const { db, element, variant } = seedProjectWithCV();
  const { db: withFork, variant: forked } = forkVariant(db, variant.id, "Computer Vision");

  const next = moveVariantToTrash(withFork, variant.id);
  assert.equal(next.variants.length, 1);
  assert.equal(next.variants[0]!.id, forked.id);
  const updatedElement = next.elements.find((e) => e.id === element.id)!;
  assert.deepEqual(updatedElement.variantIds, [forked.id]);
  assert.equal(
    updatedElement.defaultVariantId,
    forked.id,
    "si la variante por defecto se borra, se reasigna a otra existente"
  );
});

test("una referencia rota (CV que usaba una variante ahora en papelera) se conserva tal cual, sin tocar el CV", () => {
  const { db, variant, cvVersion, projectsSection } = seedProjectWithCV();
  const next = moveVariantToTrash(db, variant.id);
  const version = next.cvVersions.find((v) => v.id === cvVersion.id)!;
  const section = version.sections.find((s) => s.sectionDefinitionId === projectsSection.id)!;
  assert.equal(section.items.length, 1, "el CV sigue referenciando el id, no se limpia silenciosamente");
  assert.equal(section.items[0]!.variantId, variant.id);
});

test("restoreFromTrash sobre un elemento trae de vuelta el elemento y todas sus variantes", () => {
  const { db, element, variant } = seedProjectWithCV();
  const trashed = moveVariantToTrash(db, variant.id); // cascada -> trashea el elemento completo
  const trashEntryId = trashed.trash[0]!.id;

  const restored = restoreFromTrash(trashed, trashEntryId);
  assert.equal(restored.trash.length, 0);
  assert.equal(restored.elements.length, 1);
  assert.equal(restored.variants.length, 1);
  assert.equal(restored.elements[0]!.id, element.id);
  assert.equal(restored.variants[0]!.id, variant.id);
});

test("restoreFromTrash sobre una variante suelta la reinserta en su elemento original", () => {
  const { db, element, variant } = seedProjectWithCV();
  const { db: withFork, variant: forked } = forkVariant(db, variant.id, "Computer Vision");
  const trashed = moveVariantToTrash(withFork, variant.id); // no es cascada: queda "forked"
  const trashEntryId = trashed.trash[0]!.id;

  const restored = restoreFromTrash(trashed, trashEntryId);
  assert.equal(restored.variants.length, 2);
  const restoredElement = restored.elements.find((e) => e.id === element.id)!;
  assert.ok(restoredElement.variantIds.includes(variant.id));
  assert.ok(restoredElement.variantIds.includes(forked.id));
});

test("moveTemplateToTrash y restoreFromTrash funcionan de forma simétrica", () => {
  const { db, template } = seedProjectWithCV();
  const trashed = moveTemplateToTrash(db, template.id);
  assert.equal(trashed.templates.length, 0);
  const restored = restoreFromTrash(trashed, trashed.trash[0]!.id);
  assert.equal(restored.templates.length, 1);
  assert.equal(restored.templates[0]!.id, template.id);
});

test("moveCVProjectToTrash agrupa el proyecto con todas sus versiones y las restaura juntas", () => {
  const { db, cvProject } = seedProjectWithCV();
  const { db: withV2 } = createNewCVVersion(db, cvProject.id);

  const trashed = moveCVProjectToTrash(withV2, cvProject.id);
  assert.equal(trashed.cvProjects.length, 0);
  assert.equal(trashed.cvVersions.length, 0);

  const restored = restoreFromTrash(trashed, trashed.trash[0]!.id);
  assert.equal(restored.cvProjects.length, 1);
  assert.equal(restored.cvVersions.length, 2, "v1 y v2 vuelven juntas");
});

test("moveCVVersionToTrash rechaza borrar la única versión de un proyecto", () => {
  const { db, cvVersion } = seedProjectWithCV();
  assert.throws(() => moveCVVersionToTrash(db, cvVersion.id));
});

test("moveCVVersionToTrash reasigna la versión activa si se borra la que estaba activa", () => {
  const { db, cvProject, cvVersion } = seedProjectWithCV();
  const { db: withV2, version: v2 } = createNewCVVersion(db, cvProject.id);
  assert.equal(withV2.cvProjects.find((p) => p.id === cvProject.id)!.activeVersionId, v2.id);

  const next = moveCVVersionToTrash(withV2, v2.id);
  const project = next.cvProjects.find((p) => p.id === cvProject.id)!;
  assert.equal(project.activeVersionId, cvVersion.id, "vuelve a la única versión restante");
  assert.equal(project.versionIds.length, 1);
});

test("describeTrashEntry describe cada tipo de entidad a partir de su propio snapshot", () => {
  const { db, variant, template, cvProject, cvVersion } = seedProjectWithCV();
  const trashedVariant = moveVariantToTrash(db, variant.id); // cascada: trashea variante+elemento juntos
  const entry = trashedVariant.trash[0]!;
  assert.equal(entry.entityType, "element");
  assert.ok(describeTrashEntry(entry).includes("Scanpath Prediction"));

  const trashedTemplate = moveTemplateToTrash(db, template.id);
  assert.equal(describeTrashEntry(trashedTemplate.trash[0]!), `Template "${template.name}"`);

  const { db: withV2 } = createNewCVVersion(db, cvProject.id);
  const trashedProject = moveCVProjectToTrash(withV2, cvProject.id);
  assert.equal(describeTrashEntry(trashedProject.trash[0]!), `CV "${cvProject.name}"`);

  const trashedVersion = moveCVVersionToTrash(withV2, cvVersion.id);
  assert.ok(describeTrashEntry(trashedVersion.trash[0]!).includes(cvVersion.label));
});

test("deleteTrashEntry elimina una entrada definitivamente, sin poder restaurarla luego", () => {
  const { db, variant } = seedProjectWithCV();
  const trashed = moveVariantToTrash(db, variant.id);
  const entryId = trashed.trash[0]!.id;

  const next = deleteTrashEntry(trashed, entryId);
  assert.equal(next.trash.length, 0);
  assert.throws(() => restoreFromTrash(next, entryId));
});

test("deleteTrashEntry lanza error si la entrada no existe", () => {
  const { db } = seedProjectWithCV();
  assert.throws(() => deleteTrashEntry(db, "id-inexistente"));
});

test("emptyTrash borra todas las entradas de golpe", () => {
  const { db, variant, template } = seedProjectWithCV();
  let next = moveVariantToTrash(db, variant.id);
  next = moveTemplateToTrash(next, template.id);
  assert.equal(next.trash.length, 2);

  next = emptyTrash(next);
  assert.equal(next.trash.length, 0);
});

test("emptyTrash sobre una papelera ya vacía no hace nada raro (ni añade historial de más)", () => {
  const { db } = seedProjectWithCV();
  const historyBefore = db.history.length;
  const next = emptyTrash(db);
  assert.equal(next.trash.length, 0);
  assert.equal(next.history.length, historyBefore, "no debe añadir una entrada de historial si no había nada que vaciar");
});
