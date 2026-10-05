import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDatabase } from "../../database.js";
import { createElement } from "../../variants.js";
import { createTemplate } from "../../templates.js";
import { createCVProject, setSectionItems } from "../../cv.js";
import { describeDuplicate, findDuplicateElements } from "../duplicateDetection.js";

function setup() {
  let db = createEmptyDatabase();
  const projectsSection = db.sections.find((s) => s.key === "projects")!;
  const experienceSection = db.sections.find((s) => s.key === "experience")!;

  const created = createElement(db, {
    sectionId: projectsSection.id,
    variantName: "Original",
    fields: { title: "Scanpath Prediction" },
  });
  db = created.db;

  const templateResult = createTemplate(db, { name: "T" });
  db = templateResult.db;
  const cvResult = createCVProject(db, { name: "CV", templateId: templateResult.template.id });
  db = cvResult.db;

  return { db, project: cvResult.project, version: cvResult.version, element: created.element, variant: created.variant, projectsSection, experienceSection };
}

test("detecta el mismo elemento usado en dos secciones distintas", () => {
  const { db, version, element, variant, projectsSection, experienceSection } = setup();

  let next = setSectionItems(db, version.id, projectsSection.id, [{ elementId: element.id, variantId: variant.id }]);
  next = setSectionItems(next, version.id, experienceSection.id, [{ elementId: element.id, variantId: variant.id }]);
  const updatedVersion = next.cvVersions.find((v) => v.id === version.id)!;

  const duplicates = findDuplicateElements(updatedVersion, next);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0]!.elementId, element.id);
  assert.deepEqual(duplicates[0]!.sectionTitles, ["Projects", "Experience"]);
});

test("un elemento usado solo en una sección no se reporta como duplicado", () => {
  const { db, version, element, variant, projectsSection } = setup();
  const next = setSectionItems(db, version.id, projectsSection.id, [{ elementId: element.id, variantId: variant.id }]);
  const updatedVersion = next.cvVersions.find((v) => v.id === version.id)!;
  assert.deepEqual(findDuplicateElements(updatedVersion, next), []);
});

test("una versión sin ningún contenido no reporta duplicados", () => {
  const { db, version } = setup();
  assert.deepEqual(findDuplicateElements(version, db), []);
});

test("describeDuplicate genera el mismo formato de mensaje que el ejemplo del contexto", () => {
  const { db, version, element, variant, projectsSection, experienceSection } = setup();
  let next = setSectionItems(db, version.id, projectsSection.id, [{ elementId: element.id, variantId: variant.id }]);
  next = setSectionItems(next, version.id, experienceSection.id, [{ elementId: element.id, variantId: variant.id }]);
  const updatedVersion = next.cvVersions.find((v) => v.id === version.id)!;

  const [duplicate] = findDuplicateElements(updatedVersion, next);
  assert.equal(describeDuplicate(duplicate!, next), '"Scanpath Prediction" aparece en Projects y Experience.');
});
