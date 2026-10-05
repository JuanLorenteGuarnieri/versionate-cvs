import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDatabase } from "../database.js";
import { createTemplate } from "../templates.js";
import { createElement, forkVariant, renameVariant } from "../variants.js";
import {
  createCVProject,
  createNewCVVersion,
  removeItemFromSection,
  renameCVProject,
  renameCVVersion,
  reorderSections,
  setActiveVersion,
  setCvDisplayLanguage,
  setCvTemplate,
  setSectionItems,
} from "../cv.js";

function baseSetup() {
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
  return { db, template: templateResult.template, element: elementResult.element, variant: elementResult.variant, projectsSection };
}

test(
  "createCVProject crea el proyecto y su primera versión 'v1' enlazados entre sí",
  () => {
    const { db } = baseSetup();
    const { db: next, project, version } = createCVProject(db, { name: "Computer Vision Engineer", templateId: db.templates[0]!.id });
    assert.equal(project.versionIds.length, 1);
    assert.equal(project.activeVersionId, version.id);
    assert.equal(version.projectId, project.id);
    assert.equal(version.label, "v1");
    assert.equal(next.cvProjects.length, 1);
    assert.equal(next.cvVersions.length, 1);
  }
);

test("renameCVProject cambia el nombre del proyecto (antes no había forma de editarlo tras crearlo)", () => {
  const { db } = baseSetup();
  const { db: withProject, project } = createCVProject(db, { name: "Computer Vision Engineer", templateId: db.templates[0]!.id });
  const renamed = renameCVProject(withProject, project.id, "Backend Engineer");
  assert.equal(renamed.cvProjects[0]!.name, "Backend Engineer");
});

test("renameCVProject recorta espacios y rechaza un nombre vacío", () => {
  const { db } = baseSetup();
  const { db: withProject, project } = createCVProject(db, { name: "Original", templateId: db.templates[0]!.id });
  const renamed = renameCVProject(withProject, project.id, "  Con espacios  ");
  assert.equal(renamed.cvProjects[0]!.name, "Con espacios");
  assert.throws(() => renameCVProject(withProject, project.id, "   "), /vacío/);
});

test("renameCVProject con el mismo nombre no registra un evento de historial de más", () => {
  const { db } = baseSetup();
  const { db: withProject, project } = createCVProject(db, { name: "Original", templateId: db.templates[0]!.id });
  const historyBefore = withProject.history.length;
  const renamed = renameCVProject(withProject, project.id, "Original");
  assert.equal(renamed.history.length, historyBefore);
});

test("renameCVVersion cambia el label de una versión (antes solo se podía dejar 'v1'/'v2'...)", () => {
  const { db } = baseSetup();
  const { db: withProject, version } = createCVProject(db, { name: "Original", templateId: db.templates[0]!.id });
  const renamed = renameCVVersion(withProject, version.id, "Versión para Google");
  assert.equal(renamed.cvVersions.find((v) => v.id === version.id)!.label, "Versión para Google");
});

test("renameCVVersion recorta espacios y rechaza un nombre vacío", () => {
  const { db } = baseSetup();
  const { db: withProject, version } = createCVProject(db, { name: "Original", templateId: db.templates[0]!.id });
  const renamed = renameCVVersion(withProject, version.id, "  Con espacios  ");
  assert.equal(renamed.cvVersions.find((v) => v.id === version.id)!.label, "Con espacios");
  assert.throws(() => renameCVVersion(withProject, version.id, "   "), /vacío/);
});

test("setCvDisplayLanguage guarda el idioma de visualización en la versión (no en la template)", () => {
  const { db } = baseSetup();
  const { db: withProject, version } = createCVProject(db, { name: "Original", templateId: db.templates[0]!.id });
  assert.equal(version.displayLanguage, undefined);
  const withLang = setCvDisplayLanguage(withProject, version.id, "es");
  assert.equal(withLang.cvVersions.find((v) => v.id === version.id)!.displayLanguage, "es");
});

test(
  "setCvDisplayLanguage cambia automáticamente a la variante hermana en el idioma nuevo " +
    "(petición explícita: 'Base - vES' -> 'Base - vEN' al cambiar de español a inglés)",
  () => {
    const { db, element, variant, projectsSection } = baseSetup();
    const renamed = renameVariant(db, variant.id, "Base - vES");
    const { db: withEn, variant: enVariant } = forkVariant(renamed.db, variant.id, "Base - vEN");
    const { db: withProject, project, version } = createCVProject(withEn, { name: "CV", templateId: withEn.templates[0]!.id });
    const withItem = setSectionItems(withProject, version.id, projectsSection.id, [
      { elementId: element.id, variantId: variant.id },
    ]);

    // Primero se marca la versión como "es" (idioma de origen real) y
    // LUEGO se cambia a "en" — igual que haría el usuario en la app.
    const withEs = setCvDisplayLanguage(withItem, version.id, "es");
    const withLang = setCvDisplayLanguage(withEs, version.id, "en");
    const migratedVersion = withLang.cvVersions.find((v) => v.id === version.id)!;
    const item = migratedVersion.sections.find((s) => s.sectionDefinitionId === projectsSection.id)!.items[0]!;
    assert.equal(item.variantId, enVariant.id);
    assert.equal(project.id, withProject.cvProjects[0]!.id); // sanity check del setup
  }
);

test(
  "setCvDisplayLanguage también funciona cuando el nombre es SOLO el código, sin prefijo " +
    "(petición explícita: 'vES' a secas -> 'vEN' a secas)",
  () => {
    const { db, element, variant, projectsSection } = baseSetup();
    const renamed = renameVariant(db, variant.id, "vES");
    const { db: withEn, variant: enVariant } = forkVariant(renamed.db, variant.id, "vEN");
    const { db: withProject, version } = createCVProject(withEn, { name: "CV", templateId: withEn.templates[0]!.id });
    const withItem = setSectionItems(withProject, version.id, projectsSection.id, [
      { elementId: element.id, variantId: variant.id },
    ]);

    const withEs = setCvDisplayLanguage(withItem, version.id, "es");
    const withLang = setCvDisplayLanguage(withEs, version.id, "en");
    const migratedVersion = withLang.cvVersions.find((v) => v.id === version.id)!;
    const item = migratedVersion.sections.find((s) => s.sectionDefinitionId === projectsSection.id)!.items[0]!;
    assert.equal(item.variantId, enVariant.id);
  }
);

test("setCvDisplayLanguage funciona también en sentido inverso (inglés -> español)", () => {
  const { db, element, variant, projectsSection } = baseSetup();
  const renamed = renameVariant(db, variant.id, "General - vEN");
  const { db: withEs, variant: esVariant } = forkVariant(renamed.db, variant.id, "General - vES");
  const { db: withProject, version } = createCVProject(withEs, { name: "CV", templateId: withEs.templates[0]!.id });
  const withItem = setSectionItems(withProject, version.id, projectsSection.id, [
    { elementId: element.id, variantId: variant.id },
  ]);

  // El idioma de origen por defecto (sin tocar nada) ya es "en" — no hace
  // falta un primer cambio para establecerlo, a diferencia de los tests
  // de arriba con "es".
  const withLang = setCvDisplayLanguage(withItem, version.id, "es");
  const migratedVersion = withLang.cvVersions.find((v) => v.id === version.id)!;
  const item = migratedVersion.sections.find((s) => s.sectionDefinitionId === projectsSection.id)!.items[0]!;
  assert.equal(item.variantId, esVariant.id);
});

test("setCvDisplayLanguage deja el item tal cual si no existe una variante hermana para el idioma destino", () => {
  const { db, element, variant, projectsSection } = baseSetup();
  const { db: renamedDb } = renameVariant(db, variant.id, "Base - vES");
  const { db: withProject, version } = createCVProject(renamedDb, { name: "CV", templateId: renamedDb.templates[0]!.id });
  const withItem = setSectionItems(withProject, version.id, projectsSection.id, [
    { elementId: element.id, variantId: variant.id },
  ]);

  const withEs = setCvDisplayLanguage(withItem, version.id, "es");
  // No existe ninguna variante "Base - vEN" — el item se queda con la
  // misma variante que ya tenía, sin romper nada.
  const withLang = setCvDisplayLanguage(withEs, version.id, "en");
  const migratedVersion = withLang.cvVersions.find((v) => v.id === version.id)!;
  const item = migratedVersion.sections.find((s) => s.sectionDefinitionId === projectsSection.id)!.items[0]!;
  assert.equal(item.variantId, variant.id);
});

test("setCvDisplayLanguage no toca items cuya variante no contiene ningún código de idioma", () => {
  const { db, element, variant, projectsSection } = baseSetup();
  // El nombre por defecto del setup es "Original" — no contiene "vXX".
  const { db: withProject, version } = createCVProject(db, { name: "CV", templateId: db.templates[0]!.id });
  const withItem = setSectionItems(withProject, version.id, projectsSection.id, [
    { elementId: element.id, variantId: variant.id },
  ]);
  const withEs = setCvDisplayLanguage(withItem, version.id, "es");
  const withLang = setCvDisplayLanguage(withEs, version.id, "en");
  const migratedVersion = withLang.cvVersions.find((v) => v.id === version.id)!;
  const item = migratedVersion.sections.find((s) => s.sectionDefinitionId === projectsSection.id)!.items[0]!;
  assert.equal(item.variantId, variant.id);
});

test("createNewCVVersion clona la versión activa como 'v2' y no muta la anterior", () => {
  const { db, template, projectsSection, element, variant } = baseSetup();
  const { db: withProject, project } = createCVProject(db, { name: "CV", templateId: template.id });
  const withItems = setSectionItems(withProject, project.activeVersionId, projectsSection.id, [
    { elementId: element.id, variantId: variant.id },
  ]);

  const { db: withV2, version: v2 } = createNewCVVersion(withItems, project.id);
  assert.equal(v2.label, "v2");

  // Modificar v2 no debe afectar a v1: quitamos el item de v2 únicamente.
  const withV2Cleared = removeItemFromSection(withV2, v2.id, projectsSection.id, element.id, variant.id);

  const v1AfterChange = withV2Cleared.cvVersions.find((v) => v.label === "v1")!;
  const v1Section = v1AfterChange.sections.find((s) => s.sectionDefinitionId === projectsSection.id)!;
  assert.equal(v1Section.items.length, 1, "v1 conserva su item original: el clonado fue profundo (deep clone)");

  const updatedProject = withV2Cleared.cvProjects.find((p) => p.id === project.id)!;
  assert.equal(updatedProject.activeVersionId, v2.id, "v2 pasa a ser la versión activa");
  assert.equal(updatedProject.versionIds.length, 2);
});

test("setSectionItems con lista vacía deja la sección sin contenido (§8 del contexto)", () => {
  const { db, template, projectsSection } = baseSetup();
  const { db: withProject, project } = createCVProject(db, { name: "CV", templateId: template.id });
  const next = setSectionItems(withProject, project.activeVersionId, projectsSection.id, []);
  const version = next.cvVersions.find((v) => v.id === project.activeVersionId)!;
  const section = version.sections.find((s) => s.sectionDefinitionId === projectsSection.id)!;
  assert.equal(section.items.length, 0);
});

test("reorderSections reordena y lanza error si la lista no coincide con las secciones existentes", () => {
  const { db, template, projectsSection, element, variant } = baseSetup();
  const { db: withProject, project } = createCVProject(db, { name: "CV", templateId: template.id });
  let next = setSectionItems(withProject, project.activeVersionId, projectsSection.id, [
    { elementId: element.id, variantId: variant.id },
  ]);
  const experienceSection = db.sections.find((s) => s.key === "experience")!;
  next = setSectionItems(next, project.activeVersionId, experienceSection.id, []);

  const reordered = reorderSections(next, project.activeVersionId, [experienceSection.id, projectsSection.id]);
  const version = reordered.cvVersions.find((v) => v.id === project.activeVersionId)!;
  const orderedIds = [...version.sections].sort((a, b) => a.order - b.order).map((s) => s.sectionDefinitionId);
  assert.deepEqual(orderedIds, [experienceSection.id, projectsSection.id]);

  assert.throws(() => reorderSections(next, project.activeVersionId, [experienceSection.id]));
});

test("setCvTemplate cambia el template de la versión y valida que exista", () => {
  const { db, template, projectsSection, element, variant } = baseSetup();
  const { db: withProject, project } = createCVProject(db, { name: "CV", templateId: template.id });
  const { db: withOtherTemplate, template: otherTemplate } = createTemplate(withProject, { name: "Otro" });

  const next = setCvTemplate(withOtherTemplate, project.activeVersionId, otherTemplate.id);
  const version = next.cvVersions.find((v) => v.id === project.activeVersionId)!;
  assert.equal(version.templateId, otherTemplate.id);

  assert.throws(() => setCvTemplate(next, project.activeVersionId, "id-inexistente"), /Template not found/);
});

test("setActiveVersion cambia la versión activa del proyecto sin tocar las versiones en sí", () => {
  const { db, template } = baseSetup();
  const { db: withProject, project } = createCVProject(db, { name: "CV", templateId: template.id });
  const { db: withV2, version: v2 } = createNewCVVersion(withProject, project.id);

  const next = setActiveVersion(withV2, project.id, project.versionIds[0]!);
  const updatedProject = next.cvProjects.find((p) => p.id === project.id)!;
  assert.equal(updatedProject.activeVersionId, project.versionIds[0]);
  assert.notEqual(updatedProject.activeVersionId, v2.id);
  assert.equal(next.cvVersions.length, 2, "no borra ni crea ninguna versión");
});

test("setActiveVersion lanza error si la versión no pertenece al proyecto", () => {
  const { db, template } = baseSetup();
  const { db: withProject, project } = createCVProject(db, { name: "CV", templateId: template.id });
  assert.throws(() => setActiveVersion(withProject, project.id, "id-inexistente"), /no pertenece/);
});

test("removeItemFromSection solo afecta a la versión indicada, no borra nada de la base de datos", () => {
  const { db, template, projectsSection, element, variant } = baseSetup();
  const { db: withProject, project } = createCVProject(db, { name: "CV", templateId: template.id });
  const withItems = setSectionItems(withProject, project.activeVersionId, projectsSection.id, [
    { elementId: element.id, variantId: variant.id },
  ]);
  const next = removeItemFromSection(withItems, project.activeVersionId, projectsSection.id, element.id, variant.id);

  const version = next.cvVersions.find((v) => v.id === project.activeVersionId)!;
  const section = version.sections.find((s) => s.sectionDefinitionId === projectsSection.id)!;
  assert.equal(section.items.length, 0);
  // El elemento y la variante siguen existiendo en la base de datos.
  assert.equal(next.elements.length, 1);
  assert.equal(next.variants.length, 1);
});
