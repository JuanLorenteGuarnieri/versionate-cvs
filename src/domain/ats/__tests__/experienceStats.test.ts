import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDatabase } from "../../database.js";
import { createElement } from "../../variants.js";
import { createTemplate } from "../../templates.js";
import { createCVProject, setSectionItems } from "../../cv.js";
import { calculateExperienceStats, estimatePageCount, recommendLength } from "../experienceStats.js";

function setupExperience(ranges: Array<{ start?: string; end?: string; current?: boolean }>) {
  let db = createEmptyDatabase();
  const experienceSection = db.sections.find((s) => s.key === "experience")!;

  const itemRefs: Array<{ elementId: string; variantId: string }> = [];
  for (const [i, range] of ranges.entries()) {
    const created = createElement(db, {
      sectionId: experienceSection.id,
      variantName: "Original",
      fields: { role: `Role ${i}`, company: `Company ${i}`, dateRange: range },
    });
    db = created.db;
    itemRefs.push({ elementId: created.element.id, variantId: created.variant.id });
  }

  const templateResult = createTemplate(db, { name: "T" });
  db = templateResult.db;
  const cvResult = createCVProject(db, { name: "CV", templateId: templateResult.template.id });
  db = setSectionItems(cvResult.db, cvResult.version.id, experienceSection.id, itemRefs);

  return { db, versionId: cvResult.version.id };
}

test("calculateExperienceStats suma un único rango de fechas correctamente", () => {
  const { db, versionId } = setupExperience([{ start: "2018-01-01", end: "2020-01-01" }]);
  const stats = calculateExperienceStats(db, versionId);
  assert.equal(stats.totalYears, 2);
  assert.equal(stats.rangeCount, 1);
});

test("calculateExperienceStats suma rangos NO solapados de varios puestos", () => {
  const { db, versionId } = setupExperience([
    { start: "2015-01-01", end: "2017-01-01" }, // 2 años
    { start: "2018-01-01", end: "2021-01-01" }, // 3 años
  ]);
  const stats = calculateExperienceStats(db, versionId);
  assert.equal(stats.totalYears, 5);
  assert.equal(stats.rangeCount, 2);
});

test("calculateExperienceStats fusiona rangos SOLAPADOS en vez de sumarlos dos veces", () => {
  const { db, versionId } = setupExperience([
    { start: "2018-01-01", end: "2021-01-01" }, // trabajo principal, 3 años
    { start: "2019-01-01", end: "2019-07-01" }, // freelance en paralelo, dentro del rango anterior
  ]);
  const stats = calculateExperienceStats(db, versionId);
  assert.equal(stats.totalYears, 3); // no 3.5
});

test("calculateExperienceStats trata 'current: true' como hasta hoy", () => {
  const { db, versionId } = setupExperience([{ start: "2024-01-01", current: true }]);
  const stats = calculateExperienceStats(db, versionId);
  assert.ok(stats.totalYears !== null && stats.totalYears! > 0);
});

test("calculateExperienceStats devuelve null si no hay ninguna fecha aprovechable", () => {
  const { db, versionId } = setupExperience([{}]);
  const stats = calculateExperienceStats(db, versionId);
  assert.equal(stats.totalYears, null);
  assert.equal(stats.rangeCount, 0);
});

test("calculateExperienceStats ignora un rango con fecha de fin anterior a la de inicio", () => {
  const { db, versionId } = setupExperience([{ start: "2020-01-01", end: "2019-01-01" }]);
  const stats = calculateExperienceStats(db, versionId);
  assert.equal(stats.totalYears, null);
});

test("estimatePageCount nunca da menos de 1 página, incluso con texto vacío", () => {
  assert.equal(estimatePageCount(""), 1);
  assert.equal(estimatePageCount("hola"), 1);
});

test("estimatePageCount crece con la longitud del texto", () => {
  const short = estimatePageCount("a".repeat(1000));
  const long = estimatePageCount("a".repeat(10000));
  assert.ok(long > short);
});

test("recommendLength recomienda 1 página para poca experiencia", () => {
  const result = recommendLength(1, 3);
  assert.equal(result.recommendedMaxPages, 1);
  assert.equal(result.withinRecommendation, true);
});

test("recommendLength permite 2 páginas con 10+ años de experiencia", () => {
  const result = recommendLength(2, 12);
  assert.equal(result.recommendedMaxPages, 2);
  assert.equal(result.withinRecommendation, true);
});

test("recommendLength marca fuera de recomendación un CV de 3 páginas con poca experiencia", () => {
  const result = recommendLength(3, 2);
  assert.equal(result.withinRecommendation, false);
  assert.match(result.message, /por encima de lo recomendado/);
});

test("recommendLength sin años de experiencia conocidos aplica el criterio conservador (1 página)", () => {
  const result = recommendLength(2, null);
  assert.equal(result.recommendedMaxPages, 1);
  assert.equal(result.withinRecommendation, false);
});
