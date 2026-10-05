import test from "node:test";
import assert from "node:assert/strict";
import { isTechKeyword, TECH_KEYWORDS, TECH_KEYWORD_WEIGHT_MULTIPLIER } from "../techDictionary.js";

test("reconoce lenguajes de programación y frameworks comunes", () => {
  for (const term of ["python", "javascript", "react", "django", "kubernetes", "docker"]) {
    assert.ok(isTechKeyword(term), `"${term}" debería reconocerse como tecnología`);
  }
});

test("reconoce tecnologías específicas de IA/computer vision/robótica/gráficos (foco explícito del diccionario)", () => {
  for (const term of ["tensorflow", "pytorch", "opencv", "yolo", "cnn", "ros", "slam", "opengl", "unity", "blender", "cuda"]) {
    assert.ok(isTechKeyword(term), `"${term}" debería reconocerse como tecnología`);
  }
});

test("no reconoce palabras genéricas del anuncio como tecnología", () => {
  for (const term of ["experiencia", "equipo", "empresa", "trabajo", "candidato", "oferta"]) {
    assert.ok(!isTechKeyword(term), `"${term}" NO debería reconocerse como tecnología`);
  }
});

test("todas las entradas están normalizadas (minúsculas, sin acentos) — consistente con tokenize()", () => {
  for (const term of TECH_KEYWORDS) {
    assert.equal(term, term.toLowerCase());
    assert.equal(term, term.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  }
});

test("el diccionario tiene un tamaño sustancial (cientos de tecnologías reales)", () => {
  assert.ok(TECH_KEYWORDS.size > 500);
});

test("el multiplicador de peso es mayor que 1 (da más importancia, no menos ni igual)", () => {
  assert.ok(TECH_KEYWORD_WEIGHT_MULTIPLIER > 1);
});
