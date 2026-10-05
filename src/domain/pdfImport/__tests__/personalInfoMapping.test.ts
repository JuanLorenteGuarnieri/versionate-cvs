import test from "node:test";
import assert from "node:assert/strict";
import { extractPersonalInfoFields } from "../personalInfoMapping.js";
import { createEmptyDatabase } from "../../database.js";
import type { SectionDefinition } from "../../model/types.js";

function personalInfoSection(): SectionDefinition {
  return createEmptyDatabase().sections.find((s) => s.key === "personal-information")!;
}

test("reparte nombre, headline, email, teléfono, ubicación y links en sus propios campos (no en uno solo)", () => {
  const fields = extractPersonalInfoFields(
    ["Jane Doe", "Senior Software Engineer", "jane@example.com", "+1 415 555 0134", "San Francisco, CA", "linkedin.com/in/janedoe"],
    personalInfoSection()
  );

  assert.equal(fields.fullName, "Jane Doe");
  assert.equal(fields.headline, "Senior Software Engineer");
  assert.equal(fields.email, "jane@example.com");
  assert.equal(fields.phone, "+1 415 555 0134");
  assert.equal(fields.location, "San Francisco, CA");
  assert.deepEqual(fields.links, [{ label: "LinkedIn", url: "https://linkedin.com/in/janedoe" }]);
});

test("no inventa fechas de inicio/fin: personal-information no tiene daterange en su schema", () => {
  const fields = extractPersonalInfoFields(["Jane Doe", "jane@example.com"], personalInfoSection());
  assert.equal("dateRange" in fields, false);
});

test("varios links se acumulan todos en el campo de tipo linklist, con un nombre adivinado por dominio", () => {
  const fields = extractPersonalInfoFields(
    ["Jane Doe", "github.com/janedoe", "linkedin.com/in/janedoe", "https://jane.dev"],
    personalInfoSection()
  );
  assert.deepEqual(fields.links, [
    { label: "GitHub", url: "https://github.com/janedoe" },
    { label: "LinkedIn", url: "https://linkedin.com/in/janedoe" },
    { label: "jane.dev", url: "https://jane.dev" },
  ]);
});

test("sin ningún dato de contacto reconocible, solo asigna el nombre por posición", () => {
  const fields = extractPersonalInfoFields(["Jane Doe"], personalInfoSection());
  assert.equal(fields.fullName, "Jane Doe");
  assert.equal("email" in fields, false);
  assert.equal("links" in fields, false);
});

test("líneas vacías se ignoran", () => {
  const fields = extractPersonalInfoFields(["Jane Doe", "", "  ", "jane@example.com"], personalInfoSection());
  assert.equal(fields.fullName, "Jane Doe");
  assert.equal(fields.email, "jane@example.com");
});

test("funciona igual con una sección personal-information renombrada por el usuario (schema-driven, no hardcodeado)", () => {
  const customSection: SectionDefinition = {
    id: "personal-information",
    key: "personal-information",
    isCustom: false,
    defaultTitle: "Contacto",
    order: 0,
    createdAt: "",
    updatedAt: "",
    fieldSchema: [
      { id: "f1", key: "nombreCompleto", label: "Nombre completo", type: "text", order: 0, required: true },
      { id: "f2", key: "correoElectronico", label: "Correo electrónico", type: "text", order: 1 },
      { id: "f3", key: "telefonoMovil", label: "Teléfono móvil", type: "text", order: 2 },
    ],
  };
  const fields = extractPersonalInfoFields(["Jane Doe", "jane@example.com", "+34 600 123 456"], customSection);
  assert.equal(fields.nombreCompleto, "Jane Doe");
  assert.equal(fields.correoElectronico, "jane@example.com");
  assert.equal(fields.telefonoMovil, "+34 600 123 456");
});

test("compatibilidad hacia atrás: si el campo de links sigue siendo tipo 'list', da un string[] plano (no objetos)", () => {
  const legacySection: SectionDefinition = {
    id: "personal-information",
    key: "personal-information",
    isCustom: false,
    defaultTitle: "Personal information",
    order: 0,
    createdAt: "",
    updatedAt: "",
    fieldSchema: [
      { id: "f1", key: "fullName", label: "Full name", type: "text", order: 0, required: true },
      { id: "f2", key: "links", label: "Links", type: "list", order: 1 },
    ],
  };
  const fields = extractPersonalInfoFields(["Jane Doe", "linkedin.com/in/janedoe"], legacySection);
  assert.deepEqual(fields.links, ["https://linkedin.com/in/janedoe"]);
});

test("resuelve un enlace vía anotación PDF cuando el texto visible no tiene pinta de URL (p.ej. solo dice 'LinkedIn')", () => {
  const fields = extractPersonalInfoFields(
    ["Jane Doe", "Senior Software Engineer", "LinkedIn"],
    personalInfoSection(),
    [null, null, "https://linkedin.com/in/janedoe"]
  );
  assert.equal(fields.fullName, "Jane Doe");
  assert.equal(fields.headline, "Senior Software Engineer");
  assert.deepEqual(fields.links, [{ label: "LinkedIn", url: "https://linkedin.com/in/janedoe" }]);
});

test("una línea corta consumida por un enlace vía anotación no se usa como nombre/headline", () => {
  const fields = extractPersonalInfoFields(["Jane Doe", "LinkedIn"], personalInfoSection(), [
    null,
    "https://linkedin.com/in/janedoe",
  ]);
  assert.equal(fields.fullName, "Jane Doe");
  assert.equal(fields.headline, undefined);
  assert.deepEqual(fields.links, [{ label: "LinkedIn", url: "https://linkedin.com/in/janedoe" }]);
});

test("si la línea ya trae una URL visible, no se duplica con la anotación", () => {
  const fields = extractPersonalInfoFields(["linkedin.com/in/janedoe"], personalInfoSection(), [
    "https://linkedin.com/in/janedoe",
  ]);
  assert.equal((fields.links as unknown[]).length, 1);
});

test("sin lineLinks (parámetro omitido), se comporta exactamente igual que antes", () => {
  const fields = extractPersonalInfoFields(["Jane Doe", "jane@example.com"], personalInfoSection());
  assert.equal(fields.fullName, "Jane Doe");
  assert.equal(fields.email, "jane@example.com");
});
