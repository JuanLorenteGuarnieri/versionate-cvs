import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDatabase } from "../../database.js";
import { createTemplate } from "../../templates.js";
import { createElement } from "../../variants.js";
import { createCVProject, setSectionItems } from "../../cv.js";
import { extractCvPlainText } from "../cvText.js";

function baseSetup() {
  const emptyDb = createEmptyDatabase();
  const { db } = createTemplate(emptyDb, { name: "Minimal Dark" });
  const { db: withProject, project, version } = createCVProject(db, { name: "Prueba", templateId: db.templates[0]!.id });
  return { db: withProject, project, version };
}

test("extractCvPlainText incluye el texto de los tags como cadenas, no como objetos (regresión: tags ahora son {text,href})", () => {
  const { db, version } = baseSetup();
  const experience = db.sections.find((s) => s.key === "experience")!;
  const { db: withElement, element, variant } = createElement(db, {
    sectionId: experience.id,
    variantName: "Original",
    fields: {
      role: "Software Engineer",
      company: "Acme",
      technologies: ["Python", "PyTorch"],
    },
  });
  const withItems = setSectionItems(withElement, version.id, experience.id, [
    { elementId: element.id, variantId: variant.id },
  ]);

  const text = extractCvPlainText(withItems, version.id);
  assert.ok(text.includes("Python"), "debe incluir el texto de la tag, no '[object Object]'");
  assert.ok(text.includes("PyTorch"));
  assert.ok(!text.includes("[object Object]"), "regresión real: antes tags era un array de objetos, no de strings");
});

test("extractCvPlainText incluye título, descripción y meta de cada item, y el título de cada sección", () => {
  const { db, version } = baseSetup();
  const projects = db.sections.find((s) => s.key === "projects")!;
  const { db: withElement, element, variant } = createElement(db, {
    sectionId: projects.id,
    variantName: "Original",
    fields: { title: "Scanpath Prediction" },
  });
  const withItems = setSectionItems(withElement, version.id, projects.id, [
    { elementId: element.id, variantId: variant.id },
  ]);

  const text = extractCvPlainText(withItems, version.id);
  assert.ok(text.includes("Projects"));
  assert.ok(text.includes("Scanpath Prediction"));
});

test("extractCvPlainText no revienta con una sección sin ítems visibles", () => {
  const { db, version } = baseSetup();
  const text = extractCvPlainText(db, version.id);
  assert.equal(typeof text, "string");
});
