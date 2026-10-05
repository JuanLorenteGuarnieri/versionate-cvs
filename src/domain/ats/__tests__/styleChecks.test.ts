import test from "node:test";
import assert from "node:assert/strict";
import { checkColumnLayoutRisk, checkContrast, checkFontSize, checkIconRisk } from "../styleChecks.js";

test("negro sobre blanco da el contraste máximo conocido de WCAG (21:1)", () => {
  const result = checkContrast("#000000", "#ffffff");
  assert.equal(result.ratio, 21);
  assert.equal(result.passesAA, true);
});

test("el mismo color de texto y de fondo da el contraste mínimo (1:1), y no pasa AA", () => {
  const result = checkContrast("#777777", "#777777");
  assert.equal(result.ratio, 1);
  assert.equal(result.passesAA, false);
  assert.equal(result.passesAALarge, false);
});

test("el orden de los colores no importa (mismo ratio en ambos sentidos)", () => {
  const a = checkContrast("#222222", "#eeeeee");
  const b = checkContrast("#eeeeee", "#222222");
  assert.equal(a.ratio, b.ratio);
});

test("acepta también colores hex de 3 dígitos", () => {
  const result = checkContrast("#000", "#fff");
  assert.equal(result.ratio, 21);
});

test("un contraste gris claro sobre blanco falla WCAG AA", () => {
  const result = checkContrast("#cccccc", "#ffffff");
  assert.equal(result.passesAA, false);
});

test("checkFontSize marca como pequeño un tamaño por debajo del umbral", () => {
  const result = checkFontSize(8);
  assert.equal(result.tooSmall, true);
  assert.ok(result.recommendation?.includes("8pt"));
});

test("checkFontSize no marca nada por debajo si el tamaño es razonable", () => {
  const result = checkFontSize(10.5);
  assert.equal(result.tooSmall, false);
  assert.equal(result.recommendation, null);
});

test("checkFontSize justo en el umbral no se marca como demasiado pequeño", () => {
  assert.equal(checkFontSize(9).tooSmall, false);
});

// ---------- checkColumnLayoutRisk ----------

test("checkColumnLayoutRisk marca riesgo cuando Languages está en modo 'columns' con 2+ idiomas", () => {
  const result = checkColumnLayoutRisk("columns", 3);
  assert.equal(result.atRisk, true);
  assert.match(result.message, /columnas/i);
});

test("checkColumnLayoutRisk no marca riesgo en modo 'row' o 'list'", () => {
  assert.equal(checkColumnLayoutRisk("row", 3).atRisk, false);
  assert.equal(checkColumnLayoutRisk("list", 3).atRisk, false);
});

test("checkColumnLayoutRisk no marca riesgo con menos de 2 idiomas (no hay columnas reales que temer)", () => {
  assert.equal(checkColumnLayoutRisk("columns", 1).atRisk, false);
  assert.equal(checkColumnLayoutRisk("columns", 0).atRisk, false);
});

test("checkColumnLayoutRisk con modo indefinido (template sin cargar) no marca riesgo", () => {
  assert.equal(checkColumnLayoutRisk(undefined, 3).atRisk, false);
});

// ---------- checkIconRisk ----------

test("checkIconRisk siempre da 'sin riesgo', porque esta app no admite iconos/imágenes en el CV", () => {
  const result = checkIconRisk();
  assert.equal(result.atRisk, false);
});
