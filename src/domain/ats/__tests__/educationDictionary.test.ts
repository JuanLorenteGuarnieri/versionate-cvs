import test from "node:test";
import assert from "node:assert/strict";
import { EDUCATION_KEYWORDS, isEducationKeyword } from "../educationDictionary.js";

test("reconoce grados/titulaciones comunes en español e inglés", () => {
  for (const term of ["grado", "ingenieria", "master", "doctorado", "bachelor", "phd", "mba"]) {
    assert.ok(isEducationKeyword(term), `"${term}" debería reconocerse como término educativo`);
  }
});

test("reconoce instituciones académicas genéricas", () => {
  for (const term of ["universidad", "university", "facultad", "college"]) {
    assert.ok(isEducationKeyword(term), `"${term}" debería reconocerse como término educativo`);
  }
});

test("no reconoce tecnologías ni palabras genéricas del anuncio como educativas", () => {
  for (const term of ["python", "docker", "empresa", "equipo", "experiencia"]) {
    assert.ok(!isEducationKeyword(term));
  }
});

test("todas las entradas están normalizadas (minúsculas, sin acentos)", () => {
  for (const term of EDUCATION_KEYWORDS) {
    assert.equal(term, term.toLowerCase());
    assert.equal(term, term.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  }
});
