import test from "node:test";
import assert from "node:assert/strict";
import { currentLabelForDisplayLanguage, localeForDisplayLanguage, SUPPORTED_DISPLAY_LANGUAGES, translateDefaultLabel } from "../i18n.js";

test("localeForDisplayLanguage mapea el código corto a un locale BCP-47", () => {
  assert.equal(localeForDisplayLanguage("es"), "es-ES");
  assert.equal(localeForDisplayLanguage("en"), "en-US");
  assert.equal(localeForDisplayLanguage("zh"), "zh-CN");
  assert.equal(localeForDisplayLanguage("ja"), "ja-JP");
  assert.equal(localeForDisplayLanguage("hi"), "hi-IN");
  assert.equal(localeForDisplayLanguage("ar"), "ar-EG");
  assert.deepEqual(SUPPORTED_DISPLAY_LANGUAGES, ["es", "en", "fr", "de", "pt", "it", "zh", "ja", "hi", "ar"]);
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

test("translateDefaultLabel traduce las etiquetas predeterminadas para los nuevos idiomas", () => {
  assert.equal(translateDefaultLabel("Experience", "zh"), "工作经历");
  assert.equal(translateDefaultLabel("Experience", "ja"), "職務経験");
  assert.equal(translateDefaultLabel("Experience", "hi"), "अनुभव");
  assert.equal(translateDefaultLabel("Experience", "ar"), "الخبرة");
});
