import test from "node:test";
import assert from "node:assert/strict";
import { currentLabelForDisplayLanguage, localeForDisplayLanguage, translateDefaultLabel } from "../i18n.js";

test("localeForDisplayLanguage mapea el código corto a un locale BCP-47", () => {
  assert.equal(localeForDisplayLanguage("es"), "es-ES");
  assert.equal(localeForDisplayLanguage("en"), "en-US");
});

test("localeForDisplayLanguage cae a inglés con un idioma desconocido o sin especificar", () => {
  assert.equal(localeForDisplayLanguage("xx"), "en-US");
  assert.equal(localeForDisplayLanguage(null), "en-US");
  assert.equal(localeForDisplayLanguage(undefined), "en-US");
});

test("currentLabelForDisplayLanguage da la palabra correcta por idioma", () => {
  assert.equal(currentLabelForDisplayLanguage("es"), "Actualidad");
  assert.equal(currentLabelForDisplayLanguage("en"), "Present");
});

test("translateDefaultLabel traduce un título de sección conocido", () => {
  assert.equal(translateDefaultLabel("Experience", "es"), "Experiencia");
  assert.equal(translateDefaultLabel("Programming Languages", "es"), "Lenguajes de programación");
});

test("translateDefaultLabel deja intacto cualquier texto que no sea un valor por defecto conocido (contenido del usuario)", () => {
  assert.equal(translateDefaultLabel("Mi Sección Personalizada", "es"), "Mi Sección Personalizada");
  assert.equal(translateDefaultLabel("Experiencia", "es"), "Experiencia"); // ya está en español, no hay entrada "Experiencia"->algo
});

test("translateDefaultLabel es un no-op sin idioma o con inglés (la base)", () => {
  assert.equal(translateDefaultLabel("Experience", undefined), "Experience");
  assert.equal(translateDefaultLabel("Experience", "en"), "Experience");
});

test("translateDefaultLabel con un idioma sin diccionario devuelve el texto tal cual", () => {
  assert.equal(translateDefaultLabel("Experience", "ja"), "Experience");
});
