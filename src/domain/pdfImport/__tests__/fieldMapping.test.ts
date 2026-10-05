import test from "node:test";
import assert from "node:assert/strict";
import { buildDraftEntry, mapDraftEntryToFields, mapEntryToFields } from "../fieldMapping.js";
import { groupIntoLines, groupLinesIntoEntries } from "../entryGrouping.js";
import type { ExtractedTextItem } from "../types.js";
import { createEmptyDatabase } from "../../database.js";

function item(text: string, x: number, y: number): ExtractedTextItem {
  return { text, x, y, fontSize: 10, fontName: "f1", page: 1 };
}

function entryFrom(...lines: string[]) {
  const items = lines.map((text, i) => item(text, 50, 700 - i * 15));
  const groups = groupLinesIntoEntries(groupIntoLines(items));
  return buildDraftEntry(groups[0]!);
}

test("fecha embebida en la línea de título: se extrae y se limpia el título", () => {
  const entry = entryFrom("Software Engineer at Acme (2020 - 2023)", "Built things.");
  assert.deepEqual(entry.dateRange, { start: "2020-01-01", end: "2023-01-01" });
  assert.equal(entry.titleGuess, "Software Engineer at Acme ()");
  assert.equal(entry.descriptionGuess, "Built things.");
});

test("fecha en su propia línea, ANTES del título: el título pasa a ser la siguiente línea", () => {
  const entry = entryFrom("2020 - 2023", "Software Engineer at Acme", "Built things.");
  assert.deepEqual(entry.dateRange, { start: "2020-01-01", end: "2023-01-01" });
  assert.equal(entry.titleGuess, "Software Engineer at Acme");
  assert.equal(entry.descriptionGuess, "Built things.");
});

test("fecha en su propia línea, DESPUÉS del título: el título no se toca", () => {
  const entry = entryFrom("Software Engineer at Acme", "2020 - 2023", "Built things.");
  assert.equal(entry.titleGuess, "Software Engineer at Acme");
  assert.deepEqual(entry.dateRange, { start: "2020-01-01", end: "2023-01-01" });
  assert.equal(entry.descriptionGuess, "Built things.");
});

test("sin ninguna fecha reconocible, todo se trata como título + descripción", () => {
  const entry = entryFrom("Freelance work", "Various small projects.");
  assert.equal(entry.dateRange, null);
  assert.equal(entry.titleGuess, "Freelance work");
  assert.equal(entry.descriptionGuess, "Various small projects.");
});

test("una entrada de una sola línea usa esa línea como título, sin descripción", () => {
  const entry = entryFrom("Just a title");
  assert.equal(entry.titleGuess, "Just a title");
  assert.equal(entry.descriptionGuess, "");
});

test("mapDraftEntryToFields rellena título/fecha/descripción según el tipo de cada campo", () => {
  const db = createEmptyDatabase();
  const experience = db.sections.find((s) => s.key === "experience")!;
  const entry = entryFrom("Software Engineer at Acme (2020 - 2023)", "Built things.");

  const fields = mapDraftEntryToFields(entry, experience);
  assert.equal(fields.role, "Software Engineer at Acme ()");
  assert.deepEqual(fields.dateRange, { start: "2020-01-01", end: "2023-01-01" });
  assert.deepEqual(fields.description, { type: "richtext", blocks: [{ kind: "paragraph", runs: [{ text: "Built things." }] }] });
});

test("mapDraftEntryToFields funciona igual con una sección custom sin nombres de campo conocidos", () => {
  const fakeSection = {
    id: "custom-1",
    key: "custom-1",
    isCustom: true,
    defaultTitle: "Hobbies",
    order: 0,
    createdAt: "",
    updatedAt: "",
    fieldSchema: [
      { id: "f1", key: "nombreRaro", label: "Nombre raro", type: "text" as const, order: 0 },
      { id: "f2", key: "notas", label: "Notas", type: "longtext" as const, order: 1 },
    ],
  };
  const entry = entryFrom("Ajedrez", "Juego los fines de semana.");
  const fields = mapDraftEntryToFields(entry, fakeSection);
  assert.equal(fields.nombreRaro, "Ajedrez");
  assert.equal(fields.notas, "Juego los fines de semana.");
});

test("mapDraftEntryToFields no añade campos para lo que no se detectó (sin fecha -> sin campo de fecha)", () => {
  const db = createEmptyDatabase();
  const experience = db.sections.find((s) => s.key === "experience")!;
  const entry = entryFrom("Freelance");
  const fields = mapDraftEntryToFields(entry, experience);
  assert.equal("dateRange" in fields, false);
});

test("mapEntryToFields usa la extracción de datos personales al mapear a personal-information", () => {
  const db = createEmptyDatabase();
  const personalInfo = db.sections.find((s) => s.key === "personal-information")!;
  const entry = entryFrom("Jane Doe", "jane@example.com");
  const fields = mapEntryToFields(entry, personalInfo);
  assert.equal(fields.fullName, "Jane Doe");
  assert.equal(fields.email, "jane@example.com");
  // No debe colarse el heurístico genérico (que habría puesto todo en un
  // único campo de "título").
  assert.equal("headline" in fields, false);
});

test("mapEntryToFields se comporta igual que mapDraftEntryToFields para cualquier otra sección", () => {
  const db = createEmptyDatabase();
  const experience = db.sections.find((s) => s.key === "experience")!;
  const entry = entryFrom("Software Engineer at Acme (2020 - 2023)", "Built things.");
  assert.deepEqual(mapEntryToFields(entry, experience), mapDraftEntryToFields(entry, experience));
});
