import test from "node:test";
import assert from "node:assert/strict";
import { mapEntryWithSecondaryTitle } from "../entries/experienceEducation.js";
import { mapEntryToFields, mapDraftEntryToFields, type DraftEntry } from "../fieldMapping.js";
import type { SectionDefinition } from "../../model/types.js";

function experienceSection(): SectionDefinition {
  return {
    key: "experience",
    defaultTitle: "Experience",
    fieldSchema: [
      { key: "role", label: "Role", type: "text", order: 0, required: true },
      { key: "company", label: "Company", type: "text", order: 1, required: true },
      { key: "location", label: "Location", type: "text", order: 2 },
      { key: "dateRange", label: "Dates", type: "daterange", order: 3 },
      { key: "description", label: "Description", type: "richtext", order: 4 },
    ],
  } as unknown as SectionDefinition;
}

function educationSection(): SectionDefinition {
  return {
    key: "education",
    defaultTitle: "Education",
    fieldSchema: [
      { key: "degree", label: "Degree", type: "text", order: 0, required: true },
      { key: "institution", label: "Institution", type: "text", order: 1, required: true },
      { key: "dateRange", label: "Dates", type: "daterange", order: 2 },
      { key: "description", label: "Description", type: "richtext", order: 3 },
    ],
  } as unknown as SectionDefinition;
}

function entry(rawLines: string[]): DraftEntry {
  return { titleGuess: "", dateRange: null, descriptionGuess: "", rawLines };
}

test("separa rol y empresa cuando hay 3+ líneas claras: rol, empresa, descripción", () => {
  const fields = mapEntryWithSecondaryTitle(
    entry(["Software Engineer", "Acme Corp", "Built the payments platform from scratch."]),
    experienceSection()
  );
  assert.ok(fields);
  assert.equal(fields!.role, "Software Engineer");
  assert.equal(fields!.company, "Acme Corp");
});

test("incluye correctamente el rango de fechas cuando está en su propia línea", () => {
  const fields = mapEntryWithSecondaryTitle(
    entry(["Software Engineer", "Acme Corp", "2020 - 2023", "Built things."]),
    experienceSection()
  );
  assert.ok(fields);
  assert.deepEqual(fields!.dateRange, { start: "2020-01-01", end: "2023-01-01" });
});

test("degree/institution en Education, misma lógica genérica que Experience", () => {
  const fields = mapEntryWithSecondaryTitle(
    entry(["Master in Computer Science", "MIT", "Thesis on distributed systems."]),
    educationSection()
  );
  assert.ok(fields);
  assert.equal(fields!.degree, "Master in Computer Science");
  assert.equal(fields!.institution, "MIT");
});

test("devuelve null con solo 2 líneas (no hay evidencia suficiente) y cae al heurístico genérico vía mapEntryToFields", () => {
  const e = entry(["Software Engineer at Acme (2020 - 2023)", "Built things."]);
  const section = experienceSection();
  assert.equal(mapEntryWithSecondaryTitle(e, section), null);
  assert.deepEqual(mapEntryToFields(e, section), mapDraftEntryToFields(e, section));
});

test("devuelve null si la 'segunda línea' es en realidad una frase de descripción (termina en punto, muchas palabras)", () => {
  const fields = mapEntryWithSecondaryTitle(
    entry([
      "Software Engineer",
      "Worked on a lot of different projects across several teams over the years.",
      "More description here.",
    ]),
    experienceSection()
  );
  assert.equal(fields, null);
});

test("mapEntryToFields para experience usa la lógica de secondary title cuando aplica", () => {
  const e = entry(["Software Engineer", "Acme Corp", "Built things."]);
  const section = experienceSection();
  const fields = mapEntryToFields(e, section);
  assert.equal(fields.role, "Software Engineer");
  assert.equal(fields.company, "Acme Corp");
});
