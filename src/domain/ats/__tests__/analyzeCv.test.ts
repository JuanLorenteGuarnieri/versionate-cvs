import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDatabase } from "../../database.js";
import { createElement } from "../../variants.js";
import { createTemplate } from "../../templates.js";
import { createCVProject, setSectionItems } from "../../cv.js";
import { plainTextToRichText } from "../../richtext.js";
import { analyzeCv } from "../analyzeCv.js";

function setup() {
  let db = createEmptyDatabase();
  const projectsSection = db.sections.find((s) => s.key === "projects")!;

  const created = createElement(db, {
    sectionId: projectsSection.id,
    variantName: "Original",
    fields: { title: "Scanpath Prediction", description: plainTextToRichText("Trabajo con Python y PyTorch.") },
  });
  db = created.db;

  const templateResult = createTemplate(db, { name: "T" });
  db = templateResult.db;
  const cvResult = createCVProject(db, { name: "CV", templateId: templateResult.template.id });
  db = setSectionItems(cvResult.db, cvResult.version.id, projectsSection.id, [
    { elementId: created.element.id, variantId: created.variant.id },
  ]);

  return { db, version: cvResult.version, projectsSection, element: created.element, variant: created.variant };
}

test("analyzeCv combina duplicados, contraste, tamaño de letra y texto del CV", () => {
  const { db, version } = setup();
  const report = analyzeCv(db, version.id);

  assert.deepEqual(report.duplicateMessages, []);
  assert.equal(report.templateMissing, false);
  assert.ok(report.contrast.ratio > 0);
  assert.ok(report.cvPlainText.includes("Scanpath Prediction"));
  assert.ok(report.cvPlainText.toLowerCase().includes("python"));
});

test("analyzeCv reporta duplicados cuando el mismo elemento está en dos secciones", () => {
  const { db, version, element, variant } = setup();
  const experienceSection = db.sections.find((s) => s.key === "experience")!;
  const next = setSectionItems(db, version.id, experienceSection.id, [{ elementId: element.id, variantId: variant.id }]);

  const report = analyzeCv(next, version.id);
  assert.equal(report.duplicateMessages.length, 1);
  assert.ok(report.duplicateMessages[0]!.includes("Scanpath Prediction"));
});

test("analyzeCv con una versión sin template válida no revienta, marca templateMissing", () => {
  const { db, version } = setup();
  const dbWithoutTemplate = { ...db, templates: [] };
  const report = analyzeCv(dbWithoutTemplate, version.id);
  assert.equal(report.templateMissing, true);
  assert.equal(report.fontSize.tooSmall, false);
});

test("analyzeCv lanza un error claro si la versión no existe", () => {
  const { db } = setup();
  assert.throws(() => analyzeCv(db, "id-inexistente"), /CVVersion not found/);
});

test("analyzeCv integra todas las comprobaciones nuevas en el informe (columnas, iconos, longitud, experiencia, fechas, verbos, viñetas, secciones, keyword stuffing)", () => {
  const { db, version } = setup();
  const report = analyzeCv(db, version.id);

  assert.equal(typeof report.columnLayoutRisk.atRisk, "boolean");
  assert.equal(report.iconRisk.atRisk, false);
  assert.ok(report.length.estimatedPages >= 1);
  assert.equal(report.experience.totalYears, null); // el setup no tiene experiencia con fechas
  assert.equal(report.dateFormatConsistency.consistent, true); // sin fechas, nada que mezclar
  assert.equal(report.actionVerbs.totalBullets, 0); // el setup no usa viñetas
  assert.equal(report.bulletLength.tooShort.length, 0);
  assert.ok(report.missingSections.some((m) => m.key === "experience"));
  assert.deepEqual(report.keywordStuffing, []);
});
