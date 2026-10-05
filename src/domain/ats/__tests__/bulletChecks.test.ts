import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDatabase } from "../../database.js";
import { createElement } from "../../variants.js";
import { createTemplate } from "../../templates.js";
import { createCVProject, setSectionItems } from "../../cv.js";
import { plainTextToRichText } from "../../richtext.js";
import { checkActionVerbs, checkBulletLength, extractBullets } from "../bulletChecks.js";

function setupWithDescription(description: string) {
  let db = createEmptyDatabase();
  const experienceSection = db.sections.find((s) => s.key === "experience")!;

  const created = createElement(db, {
    sectionId: experienceSection.id,
    variantName: "Original",
    fields: { role: "Software Engineer", company: "Acme", description: plainTextToRichText(description) },
  });
  db = created.db;

  const templateResult = createTemplate(db, { name: "T" });
  db = templateResult.db;
  const cvResult = createCVProject(db, { name: "CV", templateId: templateResult.template.id });
  db = setSectionItems(cvResult.db, cvResult.version.id, experienceSection.id, [
    { elementId: created.element.id, variantId: created.variant.id },
  ]);

  return { db, versionId: cvResult.version.id };
}

test("extractBullets solo recoge las líneas marcadas como viñeta, no los párrafos normales", () => {
  const { db, versionId } = setupWithDescription("Un párrafo normal sin viñeta\n· Lideré un equipo de 5 personas");
  const bullets = extractBullets(db, versionId);
  assert.equal(bullets.length, 1);
  assert.equal(bullets[0]!.text, "Lideré un equipo de 5 personas");
});

test("checkActionVerbs reconoce un verbo de acción fuerte en español al inicio", () => {
  const { db, versionId } = setupWithDescription("· Lideré un equipo de 5 personas en el desarrollo del producto");
  const result = checkActionVerbs(db, versionId);
  assert.equal(result.totalBullets, 1);
  assert.equal(result.bulletsWithActionVerb, 1);
  assert.equal(result.ratio, 1);
  assert.deepEqual(result.weakBullets, []);
});

test("checkActionVerbs reconoce un verbo de acción fuerte en inglés al inicio", () => {
  const { db, versionId } = setupWithDescription("· Developed a distributed caching layer for the API");
  const result = checkActionVerbs(db, versionId);
  assert.equal(result.bulletsWithActionVerb, 1);
});

test("checkActionVerbs marca como 'weak' una viñeta que no empieza por un verbo reconocido", () => {
  const { db, versionId } = setupWithDescription("· Responsable del mantenimiento del sistema de pagos");
  const result = checkActionVerbs(db, versionId);
  assert.equal(result.bulletsWithActionVerb, 0);
  assert.equal(result.ratio, 0);
  assert.equal(result.weakBullets.length, 1);
});

test("checkActionVerbs con un CV sin ninguna viñeta da ratio 1 (nada que penalizar)", () => {
  const { db, versionId } = setupWithDescription("Solo un párrafo normal, sin viñetas.");
  const result = checkActionVerbs(db, versionId);
  assert.equal(result.totalBullets, 0);
  assert.equal(result.ratio, 1);
});

test("checkBulletLength marca una viñeta demasiado corta (menos de 4 palabras)", () => {
  const { db, versionId } = setupWithDescription("· Ayudé un poco");
  const result = checkBulletLength(db, versionId);
  assert.equal(result.tooShort.length, 1);
  assert.equal(result.tooLong.length, 0);
});

test("checkBulletLength marca una viñeta demasiado larga (más de 30 palabras)", () => {
  const longBullet = "· " + Array.from({ length: 35 }, (_, i) => `palabra${i}`).join(" ");
  const { db, versionId } = setupWithDescription(longBullet);
  const result = checkBulletLength(db, versionId);
  assert.equal(result.tooLong.length, 1);
  assert.equal(result.tooShort.length, 0);
});

test("checkBulletLength no marca nada para una viñeta de longitud razonable", () => {
  const { db, versionId } = setupWithDescription("· Lideré un equipo de cinco ingenieros durante ocho meses");
  const result = checkBulletLength(db, versionId);
  assert.equal(result.tooShort.length, 0);
  assert.equal(result.tooLong.length, 0);
});
