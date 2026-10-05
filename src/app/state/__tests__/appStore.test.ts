import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDatabase } from "../../../domain/database.js";
import { createElement as variantsCreateElement } from "../../../domain/variants.js";
import { createTemplate } from "../../../domain/templates.js";
import { createCVProject, setSectionItems } from "../../../domain/cv.js";
import { createMemoryStore } from "../../../persistence/memoryStore.js";
import type { Store } from "../../../persistence/store.js";
import type { AppDatabase } from "../../../domain/model/types.js";
import { createAppStore } from "../appStore.js";

function createCountingStore(initial: AppDatabase | null = null): Store & { saveCalls: number } {
  const base = createMemoryStore(initial);
  let saveCalls = 0;
  return {
    async load() {
      return base.load();
    },
    async save(db) {
      saveCalls++;
      return base.save(db);
    },
    async clear() {
      return base.clear();
    },
    get saveCalls() {
      return saveCalls;
    },
  };
}

test("load() en un store vacío crea y persiste una AppDatabase nueva", async () => {
  const store = createCountingStore();
  const app = createAppStore(store);
  assert.equal(app.getState().status, "idle");

  await app.load();

  assert.equal(app.getState().status, "ready");
  assert.ok(app.getState().db);
  assert.equal(store.saveCalls, 1, "la primera vez se persiste inmediatamente, sin esperar cambios del usuario");
});

test("load() con datos existentes los usa tal cual, sin volver a guardar", async () => {
  const existing = createEmptyDatabase();
  const store = createCountingStore(existing);
  const app = createAppStore(store);

  await app.load();

  assert.deepEqual(app.getState().db, existing);
  assert.equal(store.saveCalls, 0, "no hace falta re-guardar lo que ya estaba guardado");
});

test("load() en un store que falla deja status='error' con un mensaje, sin lanzar", async () => {
  const failingStore: Store = {
    async load() {
      throw new Error("disco dañado");
    },
    async save() {},
    async clear() {},
  };
  const app = createAppStore(failingStore);
  await app.load();
  assert.equal(app.getState().status, "error");
  assert.match(app.getState().error ?? "", /disco dañado/);
});

test("las acciones de mutación lanzan un error claro si se llaman antes de load()", () => {
  const app = createAppStore(createMemoryStore());
  assert.throws(
    () => app.createElement({ sectionId: "x", variantName: "v", fields: {} }),
    /antes de llamar a load/
  );
});

test("createElement actualiza el estado en memoria de forma síncrona", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const sectionId = app.getState().db!.sections.find((s) => s.key === "projects")!.id;

  const { elementId, variantId } = app.createElement({
    sectionId,
    variantName: "Original",
    fields: { title: "Scanpath Prediction" },
  });

  const db = app.getState().db!;
  assert.ok(db.elements.some((e) => e.id === elementId));
  assert.ok(db.variants.some((v) => v.id === variantId));
});

test("saveVariant y forkVariant delegan correctamente en el dominio", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const sectionId = app.getState().db!.sections.find((s) => s.key === "projects")!.id;
  const { variantId } = app.createElement({ sectionId, variantName: "Original", fields: { title: "A" } });

  app.saveVariant(variantId, { title: "A actualizado" });
  assert.equal(app.getState().db!.variants.find((v) => v.id === variantId)!.fields.title, "A actualizado");

  const { variantId: forkedId } = app.forkVariant(variantId, "Variante B", { title: "B" });
  assert.notEqual(forkedId, variantId);
  assert.equal(app.getState().db!.variants.length, 2);
});

test("findReferences + trashElement permiten avisar ANTES de borrar, y restore lo recupera", async () => {
  // Construimos el escenario con el dominio directamente (createCVProject
  // todavía no forma parte de la API de appStore: eso es la Fase 4), y lo
  // precargamos en el store para que `load()` lo recoja tal cual.
  let db = createEmptyDatabase();
  const sectionId = db.sections.find((s) => s.key === "projects")!.id;
  const created = variantsCreateElement(db, { sectionId, variantName: "Original", fields: {} });
  db = created.db;
  const templateResult = createTemplate(db, { name: "T" });
  db = templateResult.db;
  const cvResult = createCVProject(db, { name: "CV", templateId: templateResult.template.id });
  db = setSectionItems(cvResult.db, cvResult.version.id, sectionId, [
    { elementId: created.element.id, variantId: created.variant.id },
  ]);

  const app = createAppStore(createMemoryStore(db));
  await app.load();

  const refs = app.findReferences("element", created.element.id);
  assert.deepEqual(refs, [cvResult.version.id]);
  assert.equal(app.getState().db!.elements.length, 1, "findReferences es de solo lectura: no borra nada");

  app.trashElement(created.element.id);
  assert.equal(app.getState().db!.elements.length, 0);

  const trashEntryId = app.getState().db!.trash[0]!.id;
  app.restore(trashEntryId);
  assert.equal(app.getState().db!.elements.length, 1);
});

test("findReferences sobre un elemento sin ningún CV que lo use devuelve una lista vacía", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const sectionId = app.getState().db!.sections.find((s) => s.key === "projects")!.id;
  const { elementId } = app.createElement({ sectionId, variantName: "Original", fields: {} });

  assert.deepEqual(app.findReferences("element", elementId), []);
});

test("subscribe() notifica en cada mutación y deja de notificar tras desuscribirse", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  let notifications = 0;
  const unsubscribe = app.subscribe(() => {
    notifications++;
  });

  const sectionId = app.getState().db!.sections.find((s) => s.key === "projects")!.id;
  app.createElement({ sectionId, variantName: "Original", fields: {} });
  assert.equal(notifications, 1);

  unsubscribe();
  app.createElement({ sectionId, variantName: "Otra", fields: {} });
  assert.equal(notifications, 1, "no debe notificar tras desuscribirse");
});

test("createCVProject crea un template por defecto automáticamente si no hay ninguno", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  assert.equal(app.getState().db!.templates.length, 0);

  const { projectId, versionId } = app.createCVProject({ name: "Computer Vision Engineer" });

  const db = app.getState().db!;
  assert.equal(db.templates.length, 1, "se crea un template por defecto");
  const project = db.cvProjects.find((p) => p.id === projectId)!;
  assert.equal(project.name, "Computer Vision Engineer");
  assert.equal(project.activeVersionId, versionId);
  assert.equal(db.cvVersions.find((v) => v.id === versionId)!.templateId, db.templates[0]!.id);
});

test("createCVProject reutiliza un template existente en vez de crear otro", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const { db: withTemplate } = createTemplate(app.getState().db!, { name: "Mi template" });
  // Simulamos que ya existía un template, precargando el store para este escenario.
  const app2 = createAppStore(createMemoryStore(withTemplate));
  await app2.load();

  app2.createCVProject({ name: "CV" });
  assert.equal(app2.getState().db!.templates.length, 1, "no debe crear un segundo template");
});

test("setSectionItems actualiza el contenido de una sección de la versión activa", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const sectionId = app.getState().db!.sections.find((s) => s.key === "projects")!.id;
  const { elementId, variantId } = app.createElement({ sectionId, variantName: "Original", fields: {} });
  const { versionId } = app.createCVProject({ name: "CV" });

  app.setSectionItems(versionId, sectionId, [{ elementId, variantId }]);

  const version = app.getState().db!.cvVersions.find((v) => v.id === versionId)!;
  const section = version.sections.find((s) => s.sectionDefinitionId === sectionId)!;
  assert.equal(section.items.length, 1);
  assert.equal(section.items[0]!.elementId, elementId);

  app.setSectionItems(versionId, sectionId, []);
  const sectionAfter = app.getState().db!.cvVersions.find((v) => v.id === versionId)!.sections.find(
    (s) => s.sectionDefinitionId === sectionId
  )!;
  assert.equal(sectionAfter.items.length, 0, "una lista vacía deja la sección sin contenido (§8)");
});

test("reorderCvSections reordena las secciones de la versión activa", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const projectsId = app.getState().db!.sections.find((s) => s.key === "projects")!.id;
  const experienceId = app.getState().db!.sections.find((s) => s.key === "experience")!.id;
  const { elementId: pEl, variantId: pVar } = app.createElement({ sectionId: projectsId, variantName: "O", fields: {} });
  const { elementId: eEl, variantId: eVar } = app.createElement({ sectionId: experienceId, variantName: "O", fields: {} });
  const { versionId } = app.createCVProject({ name: "CV" });
  app.setSectionItems(versionId, projectsId, [{ elementId: pEl, variantId: pVar }]);
  app.setSectionItems(versionId, experienceId, [{ elementId: eEl, variantId: eVar }]);

  app.reorderCvSections(versionId, [experienceId, projectsId]);

  const version = app.getState().db!.cvVersions.find((v) => v.id === versionId)!;
  const orderedIds = [...version.sections].sort((a, b) => a.order - b.order).map((s) => s.sectionDefinitionId);
  assert.deepEqual(orderedIds, [experienceId, projectsId]);
});

test("trashCVProject envía el proyecto (y sus versiones) a la papelera", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const { projectId } = app.createCVProject({ name: "CV" });

  app.trashCVProject(projectId);

  const db = app.getState().db!;
  assert.equal(db.cvProjects.length, 0);
  assert.equal(db.cvVersions.length, 0);
  assert.equal(db.trash.length, 1);
  assert.equal(db.trash[0]!.entityType, "cvProject");
});
test("createTemplate / updateTemplate / forkTemplate siguen el mismo patrón Save / Save-as-new que las variantes", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();

  const { templateId } = app.createTemplate("Minimal Dark");
  assert.equal(app.getState().db!.templates.find((t) => t.id === templateId)!.name, "Minimal Dark");

  app.updateTemplate(templateId, { colors: { ...app.getState().db!.templates[0]!.colors, accent: "#ff0000" } });
  assert.equal(app.getState().db!.templates.find((t) => t.id === templateId)!.colors.accent, "#ff0000");
  assert.equal(app.getState().db!.templates.length, 1, "Save no crea un template nuevo");

  const { templateId: forkedId } = app.forkTemplate(templateId, "Minimal Dark - Bold");
  assert.notEqual(forkedId, templateId);
  assert.equal(app.getState().db!.templates.length, 2, "Save as new sí crea uno nuevo");
  const original = app.getState().db!.templates.find((t) => t.id === templateId)!;
  assert.equal(original.colors.accent, "#ff0000", "el original no cambia al bifurcar");
});

test("setCvTemplate cambia el template de un CV ya creado", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const { versionId } = app.createCVProject({ name: "CV" }); // crea el template "Default" automáticamente
  const defaultTemplateId = app.getState().db!.templates[0]!.id;

  const { templateId: newTemplateId } = app.createTemplate("Otro estilo");
  app.setCvTemplate(versionId, newTemplateId);

  const version = app.getState().db!.cvVersions.find((v) => v.id === versionId)!;
  assert.equal(version.templateId, newTemplateId);
  assert.notEqual(version.templateId, defaultTemplateId);
});

test("findReferences también funciona para templates, y trashTemplate los envía a la papelera", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const { versionId } = app.createCVProject({ name: "CV" });
  const templateId = app.getState().db!.templates[0]!.id;

  assert.deepEqual(app.findReferences("template", templateId), [versionId]);

  app.trashTemplate(templateId);
  assert.equal(app.getState().db!.templates.length, 0);
  assert.equal(app.getState().db!.trash[0]!.entityType, "template");
});

test("createNewCVVersion crea v2 a partir de la versión activa y la convierte en la nueva activa", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const { projectId, versionId: v1Id } = app.createCVProject({ name: "CV" });

  const { versionId: v2Id } = app.createNewCVVersion(projectId);

  const db = app.getState().db!;
  assert.notEqual(v2Id, v1Id);
  assert.equal(db.cvVersions.length, 2);
  assert.equal(db.cvProjects.find((p) => p.id === projectId)!.activeVersionId, v2Id);
});

test("createNewCVVersion acepta un label explícito", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const { projectId } = app.createCVProject({ name: "CV" });

  const { versionId } = app.createNewCVVersion(projectId, "Versión para Acme Corp");
  assert.equal(app.getState().db!.cvVersions.find((v) => v.id === versionId)!.label, "Versión para Acme Corp");
});

test("setActiveVersion cambia qué versión se edita, sin crear ni borrar ninguna", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const { projectId, versionId: v1Id } = app.createCVProject({ name: "CV" });
  app.createNewCVVersion(projectId);

  app.setActiveVersion(projectId, v1Id);
  assert.equal(app.getState().db!.cvProjects.find((p) => p.id === projectId)!.activeVersionId, v1Id);
  assert.equal(app.getState().db!.cvVersions.length, 2);
});

test("trashCvVersion envía una versión antigua a la papelera, y rechaza borrar la única que queda", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const { projectId, versionId: v1Id } = app.createCVProject({ name: "CV" });
  app.createNewCVVersion(projectId);

  app.trashCvVersion(v1Id);
  assert.equal(app.getState().db!.cvVersions.length, 1);

  const remainingVersionId = app.getState().db!.cvVersions[0]!.id;
  assert.throws(() => app.trashCvVersion(remainingVersionId));
});

test("deleteTrashEntry borra una entrada de la papelera definitivamente", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const sectionId = app.getState().db!.sections.find((s) => s.key === "projects")!.id;
  const { elementId } = app.createElement({ sectionId, variantName: "Original", fields: {} });
  app.trashElement(elementId);
  const trashEntryId = app.getState().db!.trash[0]!.id;

  app.deleteTrashEntry(trashEntryId);
  assert.equal(app.getState().db!.trash.length, 0);
});

test("emptyTrash vacía toda la papelera de golpe", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const sectionId = app.getState().db!.sections.find((s) => s.key === "projects")!.id;
  const { elementId: e1 } = app.createElement({ sectionId, variantName: "A", fields: {} });
  const { elementId: e2 } = app.createElement({ sectionId, variantName: "B", fields: {} });
  app.trashElement(e1);
  app.trashElement(e2);
  assert.equal(app.getState().db!.trash.length, 2);

  app.emptyTrash();
  assert.equal(app.getState().db!.trash.length, 0);
});

test("clearHistory vacía el historial de eventos de golpe", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const sectionId = app.getState().db!.sections.find((s) => s.key === "projects")!.id;
  app.createElement({ sectionId, variantName: "A", fields: {} });
  assert.ok(app.getState().db!.history.length > 0);

  app.clearHistory();
  assert.equal(app.getState().db!.history.length, 0);
});

test("addCustomSection y addFieldToSection funcionan a través del store", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const before = app.getState().db!.sections.length;

  app.addCustomSection({ defaultTitle: "Hobbies", fields: [{ key: "name", label: "Hobby", type: "text", order: 0 }] });
  assert.equal(app.getState().db!.sections.length, before + 1);

  const experienceId = app.getState().db!.sections.find((s) => s.key === "experience")!.id;
  const fieldsBefore = app.getState().db!.sections.find((s) => s.id === experienceId)!.fieldSchema.length;
  app.addFieldToSection(experienceId, { key: "remote", label: "Remote", type: "boolean", order: fieldsBefore });
  assert.equal(
    app.getState().db!.sections.find((s) => s.id === experienceId)!.fieldSchema.length,
    fieldsBefore + 1
  );
});

test("exportDatabase produce un JSON legible que reimportado da el mismo contenido (redondeo completo)", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const sectionId = app.getState().db!.sections.find((s) => s.key === "projects")!.id;
  app.createElement({ sectionId, variantName: "Original", fields: { title: "Scanpath Prediction" } });

  const json = app.exportDatabase();
  assert.ok(json.includes("Scanpath Prediction"));
  assert.ok(json.includes("\n  "), "debe ser legible, no minificado (§14 del contexto)");

  const app2 = createAppStore(createMemoryStore());
  await app2.load();
  app2.importDatabase(json);
  assert.deepEqual(app2.getState().db!.elements, app.getState().db!.elements);
});

test("importDatabase reemplaza toda la base de datos, no la combina con la anterior", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  app.createElement({
    sectionId: app.getState().db!.sections.find((s) => s.key === "projects")!.id,
    variantName: "Antiguo",
    fields: {},
  });
  const oldElementId = app.getState().db!.elements[0]!.id;

  const otherApp = createAppStore(createMemoryStore());
  await otherApp.load();
  otherApp.createElement({
    sectionId: otherApp.getState().db!.sections.find((s) => s.key === "skills")!.id,
    variantName: "Nuevo",
    fields: {},
  });
  const importedJson = otherApp.exportDatabase();

  app.importDatabase(importedJson);
  assert.equal(app.getState().db!.elements.some((e) => e.id === oldElementId), false, "el contenido anterior no debe sobrevivir a la importación");
  assert.equal(app.getState().db!.elements.length, 1);
});

test("importDatabase con un JSON inválido lanza un error y NO cambia el estado actual", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const before = app.getState().db;

  assert.throws(() => app.importDatabase("esto no es json"));
  assert.equal(app.getState().db, before, "el estado no debe tocarse si la importación falla");
});

test("importDatabase añade una entrada de historial dejando constancia de la importación", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const json = app.exportDatabase();

  app.importDatabase(json);
  const lastEntry = app.getState().db!.history[app.getState().db!.history.length - 1]!;
  assert.equal(lastEntry.type, "database_imported");
});

test("createCvFromJobDescription crea un CV nuevo nombrado a partir de la oferta, con las secciones relevantes ya seleccionadas", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const projectsSectionId = app.getState().db!.sections.find((s) => s.key === "projects")!.id;
  const { elementId, variantId } = app.createElement({
    sectionId: projectsSectionId,
    variantName: "Original",
    fields: { title: "React Dashboard" },
  });

  const { projectId, versionId } = app.createCvFromJobDescription(
    "Senior React Developer\n\nBuscamos a alguien con experiencia en React."
  );

  const db = app.getState().db!;
  const project = db.cvProjects.find((p) => p.id === projectId)!;
  assert.equal(project.name, "Senior React Developer");

  const version = db.cvVersions.find((v) => v.id === versionId)!;
  const projectsInstance = version.sections.find((s) => s.sectionDefinitionId === projectsSectionId);
  assert.ok(projectsInstance);
  assert.deepEqual(projectsInstance!.items.map((i) => ({ elementId: i.elementId, variantId: i.variantId })), [
    { elementId, variantId },
  ]);
});

test("createCvFromJobDescription no crea ninguna variante ni elemento nuevo — solo selecciona entre lo existente", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const projectsSectionId = app.getState().db!.sections.find((s) => s.key === "projects")!.id;
  app.createElement({ sectionId: projectsSectionId, variantName: "Original", fields: { title: "React Dashboard" } });

  const elementCountBefore = app.getState().db!.elements.length;
  const variantCountBefore = app.getState().db!.variants.length;

  app.createCvFromJobDescription("React Developer");

  assert.equal(app.getState().db!.elements.length, elementCountBefore);
  assert.equal(app.getState().db!.variants.length, variantCountBefore);
});

test("createCvFromJobDescription deja constancia de la oferta original en las notas de la versión", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();

  const { versionId } = app.createCvFromJobDescription("Senior React Developer\n\nDetalles del puesto...");

  const version = app.getState().db!.cvVersions.find((v) => v.id === versionId)!;
  assert.ok(version.metadata.notes?.includes("Senior React Developer"));
});

test("createCvFromJobDescription reutiliza el template por defecto igual que createCVProject", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  assert.equal(app.getState().db!.templates.length, 0);

  app.createCvFromJobDescription("React Developer");

  assert.equal(app.getState().db!.templates.length, 1);
});

test("createCvFromSelection crea un CV con exactamente la selección dada, omitiendo secciones vacías", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const projectsSectionId = app.getState().db!.sections.find((s) => s.key === "projects")!.id;
  const experienceSectionId = app.getState().db!.sections.find((s) => s.key === "experience")!.id;
  const { elementId, variantId } = app.createElement({
    sectionId: projectsSectionId,
    variantName: "Original",
    fields: { title: "React Dashboard" },
  });

  const { projectId, versionId } = app.createCvFromSelection({
    name: "Mi CV a medida",
    jobDescriptionText: "React Developer",
    sections: [
      { sectionDefinitionId: projectsSectionId, items: [{ elementId, variantId }] },
      { sectionDefinitionId: experienceSectionId, items: [] },
    ],
  });

  const db = app.getState().db!;
  assert.equal(db.cvProjects.find((p) => p.id === projectId)!.name, "Mi CV a medida");
  const version = db.cvVersions.find((v) => v.id === versionId)!;
  assert.equal(version.sections.length, 1);
  assert.equal(version.sections[0]!.sectionDefinitionId, projectsSectionId);
});

test("createCvFromJobDescription detecta el idioma de la oferta y lo fija como idioma de visualización del CV", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();

  const { versionId: esVersionId } = app.createCvFromJobDescription(
    "Buscamos un desarrollador con experiencia en Python para nuestro equipo de trabajo"
  );
  const esVersion = app.getState().db!.cvVersions.find((v) => v.id === esVersionId)!;
  assert.equal(esVersion.displayLanguage, "es");

  const { versionId: enVersionId } = app.createCvFromJobDescription(
    "We are looking for a developer with experience in Python for our team"
  );
  const enVersion = app.getState().db!.cvVersions.find((v) => v.id === enVersionId)!;
  assert.equal(enVersion.displayLanguage, "en");
});

test("createCvFromSelection acepta un displayLanguage explícito (usado por la pantalla de revisión)", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();

  const { versionId } = app.createCvFromSelection({
    name: "Test",
    jobDescriptionText: "React developer",
    sections: [],
    displayLanguage: "en",
  });
  const version = app.getState().db!.cvVersions.find((v) => v.id === versionId)!;
  assert.equal(version.displayLanguage, "en");
});

test("createCvFromJobDescription nombra la versión inicial según el idioma detectado (vES/vEN), no 'v1'", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();

  const { versionId: esVersionId } = app.createCvFromJobDescription(
    "Buscamos un desarrollador con experiencia en Python para nuestro equipo de trabajo"
  );
  const esVersion = app.getState().db!.cvVersions.find((v) => v.id === esVersionId)!;
  assert.equal(esVersion.label, "vES");

  const { versionId: enVersionId } = app.createCvFromJobDescription(
    "We are looking for a developer with experience in Python for our team"
  );
  const enVersion = app.getState().db!.cvVersions.find((v) => v.id === enVersionId)!;
  assert.equal(enVersion.label, "vEN");
});

test("createCVProject (flujo manual normal) sigue nombrando la primera versión 'v1'", async () => {
  const app = createAppStore(createMemoryStore());
  await app.load();
  const { versionId } = app.createCVProject({ name: "Mi CV" });
  const version = app.getState().db!.cvVersions.find((v) => v.id === versionId)!;
  assert.equal(version.label, "v1");
});
