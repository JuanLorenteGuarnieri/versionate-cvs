import test from "node:test";
import assert from "node:assert/strict";
import { formatDateRangeForDisplay, formatIsoDateForDisplay, formatTimestampForDisplay } from "../formatting.js";

test("formatIsoDateForDisplay de null/undefined/'' da string vacío", () => {
  assert.equal(formatIsoDateForDisplay(null), "");
  assert.equal(formatIsoDateForDisplay(undefined), "");
  assert.equal(formatIsoDateForDisplay(""), "");
});

test("formatIsoDateForDisplay incluye el año para una fecha válida", () => {
  const result = formatIsoDateForDisplay("2020-06-15");
  assert.ok(result.includes("2020"), `esperaba que incluyera 2020, dio: "${result}"`);
});

test("formatIsoDateForDisplay no revienta con un valor no reconocible", () => {
  assert.equal(formatIsoDateForDisplay("no-es-una-fecha"), "no-es-una-fecha");
});

test("formatDateRangeForDisplay de null/undefined da string vacío", () => {
  assert.equal(formatDateRangeForDisplay(null), "");
  assert.equal(formatDateRangeForDisplay(undefined), "");
});

test("formatDateRangeForDisplay con start y end incluye ambos años separados por un guion", () => {
  const result = formatDateRangeForDisplay({ start: "2018-01-01", end: "2020-01-01" });
  assert.ok(result.includes("2018") && result.includes("2020"));
  assert.ok(result.includes("–"));
});

test("formatDateRangeForDisplay con current:true muestra 'Actualidad' en vez de la fecha de fin", () => {
  const result = formatDateRangeForDisplay({ start: "2022-01-01", end: "2023-01-01", current: true });
  assert.ok(result.includes("Actualidad"));
  assert.ok(!result.includes("2023"));
});

test("formatDateRangeForDisplay solo con start, o solo con end, no deja separadores sueltos", () => {
  assert.ok(!formatDateRangeForDisplay({ start: "2020-01-01" }).includes("–"));
  assert.ok(!formatDateRangeForDisplay({ end: "2020-01-01" }).includes("–"));
});

test("formatDateRangeForDisplay de un objeto vacío da string vacío", () => {
  assert.equal(formatDateRangeForDisplay({}), "");
});

test("formatTimestampForDisplay de un ISO válido incluye el año y no revienta", () => {
  const result = formatTimestampForDisplay("2026-08-26T10:15:00.000Z");
  assert.ok(result.includes("2026"));
});

test("formatTimestampForDisplay con un valor no reconocible lo devuelve tal cual", () => {
  assert.equal(formatTimestampForDisplay("no-es-una-fecha"), "no-es-una-fecha");
});
