import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDatabase } from "../../database.js";
import { createElement } from "../../variants.js";
import { createTemplate } from "../../templates.js";
import { createCVProject, setSectionItems } from "../../cv.js";
import { findMissingStandardSections } from "../sectionCoverage.js";

function setup() {
  let db = createEmptyDatabase();
  const templateResult = createTemplate(db, { name: "T" });
  db = templateResult.db;
  const cvResult = createCVProject(db, { name: "CV", templateId: templateResult.template.id });
  return { db: cvResult.db, versionId: cvResult.version.id };
}

test("un CV completamente vacío reporta como ausentes experience/education/skills", () => {
  const { db, versionId } = setup();
  const missing = findMissingStandardSections(db, versionId);
  const keys = missing.map((m) => m.key).sort();
  assert.deepEqual(keys, ["education", "experience", "skills"]);
  // La sección SÍ existe en la base de datos (viene por defecto) — lo que falta es contenido en ESTE CV.
  assert.ok(missing.every((m) => m.sectionMissingFromDatabase === false));
});

test("una sección con contenido visible en el CV deja de reportarse como ausente", () => {
  const { db: base, versionId } = setup();
  const experienceSection = base.sections.find((s) => s.key === "experience")!;
  const created = createElement(base, { sectionId: experienceSection.id, variantName: "Original", fields: { role: "Dev" } });
  const withItem = setSectionItems(created.db, versionId, experienceSection.id, [
    { elementId: created.element.id, variantId: created.variant.id },
  ]);

  const missing = findMissingStandardSections(withItem, versionId);
  assert.ok(!missing.some((m) => m.key === "experience"));
  assert.ok(missing.some((m) => m.key === "education"));
});

test("si la sección ni siquiera existe en la base de datos, se marca 'sectionMissingFromDatabase'", () => {
  const { db, versionId } = setup();
  const withoutSkills = { ...db, sections: db.sections.filter((s) => s.key !== "skills") };
  const missing = findMissingStandardSections(withoutSkills, versionId);
  const skillsEntry = missing.find((m) => m.key === "skills")!;
  assert.equal(skillsEntry.sectionMissingFromDatabase, true);
});
