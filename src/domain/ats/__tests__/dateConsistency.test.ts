import test from "node:test";
import assert from "node:assert/strict";
import { checkDateFormatConsistency } from "../dateConsistency.js";

test("un CV que usa un único formato de fecha en todas partes es consistente", () => {
  const text = "Software Engineer\nJan 2020 - Dec 2021\nOtro puesto\nJan 2018 - Dec 2019";
  const result = checkDateFormatConsistency(text);
  assert.equal(result.consistent, true);
  assert.equal(result.formatsUsed.length, 1);
});

test("mezclar 'Jan 2020' con '01/2020' se marca como inconsistente", () => {
  const text = "Software Engineer\nJan 2020 - Dec 2021\nOtro puesto\n01/2018 - 01/2019";
  const result = checkDateFormatConsistency(text);
  assert.equal(result.consistent, false);
  assert.equal(result.formatsUsed.length, 2);
  const ids = result.formatsUsed.map((f) => f.id);
  assert.ok(ids.includes("month-name-year"));
  assert.ok(ids.includes("mm-slash-yyyy"));
});

test("un texto sin ninguna fecha reconocible no marca ningún formato", () => {
  const result = checkDateFormatConsistency("Sin fechas por aquí.");
  assert.equal(result.consistent, true);
  assert.deepEqual(result.formatsUsed, []);
});

test("reconoce fechas en español ('enero 2020')", () => {
  const result = checkDateFormatConsistency("Experiencia: enero 2020 - marzo 2021");
  assert.equal(result.formatsUsed.some((f) => f.id === "month-name-year"), true);
});

test("cuenta cuántas veces aparece cada formato", () => {
  const text = "Jan 2020, Feb 2021, Mar 2022 y 01/2020, 02/2021";
  const result = checkDateFormatConsistency(text);
  const monthFormat = result.formatsUsed.find((f) => f.id === "month-name-year")!;
  const slashFormat = result.formatsUsed.find((f) => f.id === "mm-slash-yyyy")!;
  assert.equal(monthFormat.count, 3);
  assert.equal(slashFormat.count, 2);
});
