import test from "node:test";
import assert from "node:assert/strict";
import { findDateRange } from "../dateParsing.js";

test("años sueltos separados por guion", () => {
  const result = findDateRange("2020 - 2023");
  assert.deepEqual(result?.value, { start: "2020-01-01", end: "2023-01-01" });
});

test("con guion largo (en dash) y sin espacios", () => {
  const result = findDateRange("2020–2023");
  assert.deepEqual(result?.value, { start: "2020-01-01", end: "2023-01-01" });
});

test("mes en inglés + año", () => {
  const result = findDateRange("Jan 2020 - Dec 2022");
  assert.deepEqual(result?.value, { start: "2020-01-01", end: "2022-12-01" });
});

test("mes en español + año, con 'de'", () => {
  const result = findDateRange("enero de 2020 - diciembre de 2022");
  assert.deepEqual(result?.value, { start: "2020-01-01", end: "2022-12-01" });
});

test("formato MM/YYYY", () => {
  const result = findDateRange("01/2020 - 06/2022");
  assert.deepEqual(result?.value, { start: "2020-01-01", end: "2022-06-01" });
});

test("'Present' se convierte en current:true, sin fecha de fin", () => {
  const result = findDateRange("2021 - Present");
  assert.deepEqual(result?.value, { start: "2021-01-01", current: true });
});

test("'Actualidad' también cuenta como 'current'", () => {
  const result = findDateRange("2021 - Actualidad");
  assert.deepEqual(result?.value, { start: "2021-01-01", current: true });
});

test("funciona aunque el rango esté en medio de una frase más larga", () => {
  const result = findDateRange("Software Engineer, Acme Corp (2020 - 2023), remote");
  assert.deepEqual(result?.value, { start: "2020-01-01", end: "2023-01-01" });
  assert.equal(result?.matchedText, "2020 - 2023");
});

test("devuelve null cuando no hay ningún rango reconocible", () => {
  assert.equal(findDateRange("Built cool things and fixed bugs"), null);
  assert.equal(findDateRange(""), null);
});

test("no confunde un número de teléfono o similar con un rango de fechas", () => {
  assert.equal(findDateRange("+34 600 123 456"), null);
});

test("reconoce el rango aunque falte el separador (glifo de guion no mapeado en la fuente del PDF)", () => {
  const result = findDateRange("Computer Science sept 2020  jun 2024");
  assert.deepEqual(result?.value, { start: "2020-09-01", end: "2024-06-01" });
});

test("reconoce el rango con 'current' aunque falte el separador", () => {
  const result = findDateRange("Research Intern ene 2025  Present");
  assert.deepEqual(result?.value, { start: "2025-01-01", current: true });
});

test("un teléfono largo sin espacios NO se confunde con dos fechas pegadas", () => {
  // Regresión: permitir "sin separador" a secas (sin exigir al menos un
  // espacio) hacía que "611659219" se leyera como "6116" + "5921".
  assert.equal(findDateRange("Phone :  34 611659219"), null);
});

test("regresión: reconoce el rango cuando el separador es un glifo sin mapeo Unicode (zona de uso privado)", () => {
  // Carácter real (U+E049) encontrado extrayendo con pdf.js un PDF
  // exportado por esta misma app: la fuente no tiene ToUnicode para el
  // guion largo, así que pdf.js devuelve el glifo "en bruto" en vez de "–"
  // o de una cadena vacía.
  const result = findDateRange("Computer Science sept 2020 \uE049 jun 2024");
  assert.deepEqual(result?.value, { start: "2020-09-01", end: "2024-06-01" });
});
