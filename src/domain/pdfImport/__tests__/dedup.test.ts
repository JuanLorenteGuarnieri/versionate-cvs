import test from "node:test";
import assert from "node:assert/strict";
import { findSimilarElements } from "../mapping/dedup.js";
import { createEmptyDatabase } from "../../database.js";
import { createElement } from "../../variants.js";

function withProject(title: string) {
  const db = createEmptyDatabase();
  const section = db.sections.find((s) => s.key === "projects")!;
  const { db: next } = createElement(db, {
    sectionId: section.id,
    variantName: "Original",
    fields: { title },
  });
  return { db: next, sectionId: section.id };
}

test("encuentra un elemento existente con el mismo título exacto", () => {
  const { db, sectionId } = withProject("Scanpath Prediction");
  const candidates = findSimilarElements(db, sectionId, "Scanpath Prediction");
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]!.similarity, 1);
});

test("encuentra un elemento existente con pequeñas variaciones (mayúsculas, tildes, puntuación)", () => {
  const { db, sectionId } = withProject("Predicción de Trayectorias Oculares");
  const candidates = findSimilarElements(db, sectionId, "prediccion de trayectorias oculares.");
  assert.equal(candidates.length, 1);
  assert.ok(candidates[0]!.similarity > 0.9);
});

test("no encuentra nada para un título genuinamente distinto", () => {
  const { db, sectionId } = withProject("Scanpath Prediction");
  const candidates = findSimilarElements(db, sectionId, "VR Viewer");
  assert.equal(candidates.length, 0);
});

test("no mezcla elementos de OTRA sección aunque el título coincida", () => {
  const { db, sectionId: projectsId } = withProject("Scanpath Prediction");
  const experienceSectionId = db.sections.find((s) => s.key === "experience")!.id;
  assert.notEqual(projectsId, experienceSectionId);
  const candidates = findSimilarElements(db, experienceSectionId, "Scanpath Prediction");
  assert.equal(candidates.length, 0);
});

test("una base de datos vacía nunca da candidatos", () => {
  const db = createEmptyDatabase();
  const sectionId = db.sections.find((s) => s.key === "projects")!.id;
  assert.deepEqual(findSimilarElements(db, sectionId, "Anything"), []);
});

test("con un título vacío, no propone nada (evita falsos positivos triviales)", () => {
  const { db, sectionId } = withProject("Scanpath Prediction");
  assert.deepEqual(findSimilarElements(db, sectionId, ""), []);
});
