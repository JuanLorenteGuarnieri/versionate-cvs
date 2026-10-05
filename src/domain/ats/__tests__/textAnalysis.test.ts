import test from "node:test";
import assert from "node:assert/strict";
import { detectKeywordStuffing, extractKeywordFrequencies, tokenize } from "../textAnalysis.js";

test("tokenize separa por espacios/puntuación y normaliza a minúsculas sin acentos", () => {
  assert.deepEqual(tokenize("Diseño, Programación y Comunicación."), ["diseno", "programacion", "comunicacion"]);
});

test("tokenize conserva términos técnicos con puntos/símbolos internos", () => {
  assert.deepEqual(tokenize("Node.js, C++ y C#"), ["node.js", "c++", "c#"]);
});

test("tokenize descarta tokens de un solo carácter", () => {
  assert.deepEqual(tokenize("a b cc"), ["cc"]);
});

test("tokenize de un texto vacío da una lista vacía", () => {
  assert.deepEqual(tokenize(""), []);
});

test("extractKeywordFrequencies cuenta repeticiones y ordena de más a menos frecuente", () => {
  const result = extractKeywordFrequencies("Python Python JavaScript Python JavaScript");
  assert.deepEqual(result, [
    { term: "python", count: 3 },
    { term: "javascript", count: 2 },
  ]);
});

test("extractKeywordFrequencies excluye palabras vacías por defecto", () => {
  const result = extractKeywordFrequencies("el desarrollador y la desarrolladora");
  const terms = result.map((r) => r.term);
  assert.ok(!terms.includes("el"));
  assert.ok(!terms.includes("y"));
  assert.ok(!terms.includes("la"));
  assert.ok(terms.includes("desarrollador"));
});

test("extractKeywordFrequencies puede incluir palabras vacías si se pide explícitamente", () => {
  const result = extractKeywordFrequencies("el gato", { excludeStopwords: false });
  assert.ok(result.some((r) => r.term === "el"));
});

// ---------- detectKeywordStuffing ----------

test("detectKeywordStuffing marca un término que se repite de forma antinatural", () => {
  const words = Array(20).fill("python").concat(["desarrollo", "backend", "equipo", "proyecto", "cliente"]);
  const text = words.join(" ");
  const flags = detectKeywordStuffing(text);
  assert.equal(flags.length, 1);
  assert.equal(flags[0]!.term, "python");
  assert.equal(flags[0]!.count, 20);
});

test("detectKeywordStuffing no marca nada en un texto con vocabulario variado y natural", () => {
  const text =
    "Desarrollé una API en Python usando FastAPI, con tests en pytest y despliegue en Docker sobre AWS, " +
    "colaborando con un equipo de cinco personas en metodología ágil.";
  const flags = detectKeywordStuffing(text);
  assert.deepEqual(flags, []);
});

test("detectKeywordStuffing no marca una palabra repetida pocas veces aunque el texto sea muy corto", () => {
  // 2 repeticiones de "java" sobre muy pocas palabras totales podría superar
  // el umbral de RATIO, pero no el de CONTEO mínimo (por defecto 5).
  const flags = detectKeywordStuffing("java java desarrollo");
  assert.deepEqual(flags, []);
});

test("detectKeywordStuffing respeta umbrales personalizados", () => {
  const text = Array(3).fill("java").concat(["python", "sql"]).join(" ");
  const flags = detectKeywordStuffing(text, { minCount: 3, minRatio: 0.1 });
  assert.equal(flags.length, 1);
  assert.equal(flags[0]!.term, "java");
});

test("regresión: 'más'/'también' se filtran de verdad, no solo su forma con tilde (bug real de normalización)", () => {
  const result = extractKeywordFrequencies("más también Python");
  const terms = result.map((r) => r.term);
  assert.ok(!terms.includes("mas"));
  assert.ok(!terms.includes("tambien"));
  assert.ok(terms.includes("python"));
});

test("filtra palabras vacías comunes en español que antes se colaban como keywords", () => {
  const result = extractKeywordFrequencies("no si tu tareas desde todo largo vida Python");
  const terms = result.map((r) => r.term);
  for (const noise of ["no", "si", "tu", "tareas", "desde", "todo", "largo", "vida"]) {
    assert.ok(!terms.includes(noise), `"${noise}" debería filtrarse`);
  }
  assert.ok(terms.includes("python"));
});

test("no filtra palabras de contenido reales que casualmente son cortas o parecidas a ruido genérico", () => {
  const result = extractKeywordFrequencies("Python Kubernetes Docker liderazgo");
  const terms = result.map((r) => r.term);
  assert.ok(terms.includes("python"));
  assert.ok(terms.includes("kubernetes"));
  assert.ok(terms.includes("docker"));
  assert.ok(terms.includes("liderazgo"));
});
