import test from "node:test";
import assert from "node:assert/strict";
import { compareWithJobDescription } from "../jobComparison.js";

test("detecta keywords presentes y ausentes del CV", () => {
  const cvText = "Experiencia con Python y Django. Buen manejo de SQL.";
  const jobText = "Buscamos experiencia en Python, Django, Kubernetes y React.";

  const result = compareWithJobDescription(cvText, jobText);
  const present = result.presentInCv.map((k) => k.term);
  const missing = result.missingFromCv.map((k) => k.term);

  assert.ok(present.includes("python"));
  assert.ok(present.includes("django"));
  assert.ok(missing.includes("kubernetes"));
  assert.ok(missing.includes("react"));
});

test("respeta el límite topN de keywords de la oferta", () => {
  const jobText = "uno dos tres cuatro cinco seis siete ocho nueve diez";
  const result = compareWithJobDescription("", jobText, 3);
  assert.equal(result.jobKeywords.length, 3);
});

test("un CV vacío no marca nada como presente", () => {
  const result = compareWithJobDescription("", "Python Django Kubernetes");
  assert.equal(result.presentInCv.length, 0);
  assert.equal(result.missingFromCv.length, 3);
});

test("una oferta vacía no produce ninguna keyword que comparar", () => {
  const result = compareWithJobDescription("Python Django", "");
  assert.deepEqual(result.jobKeywords, []);
  assert.deepEqual(result.presentInCv, []);
  assert.deepEqual(result.missingFromCv, []);
});

test("no distingue mayúsculas/acentos entre la oferta y el CV", () => {
  const result = compareWithJobDescription("Tengo experiencia en diseño", "Buscamos DISEÑO gráfico");
  assert.ok(result.presentInCv.some((k) => k.term === "diseno"));
});

test("matchScore es 100 cuando el CV cubre todas las menciones de keywords de la oferta", () => {
  const result = compareWithJobDescription("Python Django SQL", "Python Django");
  assert.equal(result.matchScore, 100);
});

test("matchScore es 0 cuando el CV no cubre ninguna keyword", () => {
  const result = compareWithJobDescription("", "Python Django Kubernetes");
  assert.equal(result.matchScore, 0);
});

test("matchScore pondera por frecuencia de mención, no por keywords distintas", () => {
  // La oferta menciona "python" 3 veces y "kubernetes" 1 vez: cubrir solo
  // "python" debe dar más de la mitad, no el 50% que daría un conteo por
  // keyword distinta.
  const result = compareWithJobDescription("Experiencia con Python", "Python Python Python Kubernetes");
  assert.equal(result.matchScore, 75);
});

test("matchScore es 0 (no NaN) cuando la oferta no tiene ninguna keyword reconocible", () => {
  const result = compareWithJobDescription("Python Django", "y de la");
  assert.equal(result.matchScore, 0);
});

test("matchScore da más peso a una keyword tecnológica que a una genérica de la misma frecuencia", () => {
  // La oferta menciona "python" (tecnología) y "candidato" (genérica) una vez cada una.
  // Cubrir SOLO "python" debería dar una puntuación mucho más alta que cubrir SOLO "candidato",
  // porque "python" pesa más (TECH_KEYWORD_WEIGHT_MULTIPLIER).
  const onlyTech = compareWithJobDescription("Experiencia con Python", "Python y buen candidato");
  const onlyGeneric = compareWithJobDescription("Buen candidato", "Python y buen candidato");
  assert.ok(onlyTech.matchScore > onlyGeneric.matchScore);
});
