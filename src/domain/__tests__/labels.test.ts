import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDatabase } from "../database.js";
import { createElement } from "../variants.js";
import { guessElementLabel } from "../labels.js";

test("usa 'title' cuando está presente", () => {
  const db0 = createEmptyDatabase();
  const sectionId = db0.sections.find((s) => s.key === "projects")!.id;
  const { db, element } = createElement(db0, {
    sectionId,
    variantName: "Original",
    fields: { title: "Scanpath Prediction" },
  });
  assert.equal(guessElementLabel(element, db), "Scanpath Prediction");
});

test("cae a 'role' si no hay 'title', y a otras claves en orden de prioridad", () => {
  const db0 = createEmptyDatabase();
  const sectionId = db0.sections.find((s) => s.key === "experience")!.id;
  const { db, element } = createElement(db0, {
    sectionId,
    variantName: "Original",
    fields: { role: "Software Engineer", company: "Acme" },
  });
  assert.equal(guessElementLabel(element, db), "Software Engineer");
});

test("si ningún campo prioritario tiene contenido, usa el nombre de la variante", () => {
  const db0 = createEmptyDatabase();
  const sectionId = db0.sections.find((s) => s.key === "skills")!.id;
  const { db, element } = createElement(db0, {
    sectionId,
    variantName: "Original",
    fields: { level: "Avanzado" }, // sin 'name' relleno
  });
  assert.equal(guessElementLabel(element, db), "Original");
});

test("un elemento sin variante por defecto válida no revienta", () => {
  const db0 = createEmptyDatabase();
  const sectionId = db0.sections.find((s) => s.key === "projects")!.id;
  const { db, element } = createElement(db0, { sectionId, variantName: "Original", fields: {} });
  const broken = { ...element, defaultVariantId: "id-inexistente" };
  assert.equal(guessElementLabel(broken, db), "(sin contenido)");
});

test(
  "un 'labelOverride' explícito gana siempre sobre lo adivinado de los campos " +
    "(petición explícita: poder fijar el nombre que sale en las listas)",
  () => {
    const db0 = createEmptyDatabase();
    const sectionId = db0.sections.find((s) => s.key === "projects")!.id;
    const { db, element } = createElement(db0, {
      sectionId,
      variantName: "Original",
      fields: { title: "Scanpath Prediction" },
    });
    const renamed = { ...element, labelOverride: "Mi proyecto estrella" };
    assert.equal(guessElementLabel(renamed, db), "Mi proyecto estrella");
  }
);

test("un 'labelOverride' vacío o solo con espacios no cuenta como override (vuelve a adivinarlo)", () => {
  const db0 = createEmptyDatabase();
  const sectionId = db0.sections.find((s) => s.key === "projects")!.id;
  const { db, element } = createElement(db0, {
    sectionId,
    variantName: "Original",
    fields: { title: "Scanpath Prediction" },
  });
  const withBlankOverride = { ...element, labelOverride: "   " };
  assert.equal(guessElementLabel(withBlankOverride, db), "Scanpath Prediction");
});
