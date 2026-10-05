import test from "node:test";
import assert from "node:assert/strict";
import { addFieldToSection, addSectionDefinition, createEmptyDatabase, STANDARD_SECTION_KEY_ORDER } from "../database.js";

test("createEmptyDatabase incluye las secciones estándar del §3 del contexto", () => {
  const db = createEmptyDatabase();
  const keys = db.sections.map((s) => s.key).sort();
  assert.deepEqual(keys, [
    "awards",
    "certifications",
    "courses",
    "education",
    "experience",
    "languages",
    "personal-information",
    "profile",
    "projects",
    "publications",
    "references",
    "skills",
    "volunteering",
  ]);
  assert.equal(db.settings.theme, "dark", "el modo oscuro debe ser el predeterminado (§22)");
});

test("la sección 'profile' se titula 'Summary' por defecto (renombrada, mismo key interno)", () => {
  const db = createEmptyDatabase();
  const profile = db.sections.find((s) => s.key === "profile")!;
  assert.equal(profile.defaultTitle, "Summary");
});

test("la sección 'skills' fusiona Programming Languages/Technologies/Soft Skills en 3 campos de etiquetas", () => {
  const db = createEmptyDatabase();
  const skills = db.sections.find((s) => s.key === "skills")!;
  assert.deepEqual(
    skills.fieldSchema.map((f) => ({ key: f.key, label: f.label, type: f.type })),
    [
      { key: "programmingLanguages", label: "Programming Languages", type: "tags" },
      { key: "technologies", label: "Technologies", type: "tags" },
      { key: "softSkills", label: "Soft Skills", type: "tags" },
    ]
  );
});

test("la sección 'projects' no tiene campo de fecha y sí tiene un campo 'subtitle'", () => {
  const db = createEmptyDatabase();
  const projects = db.sections.find((s) => s.key === "projects")!;
  const keys = projects.fieldSchema.map((f) => f.key);
  assert.ok(!keys.includes("dateRange"), "projects ya no debe tener campo de fecha");
  assert.ok(keys.includes("subtitle"), "projects debe tener un campo 'subtitle'");
});

test("las colecciones empiezan vacías", () => {
  const db = createEmptyDatabase();
  assert.equal(db.elements.length, 0);
  assert.equal(db.variants.length, 0);
  assert.equal(db.cvProjects.length, 0);
  assert.equal(db.trash.length, 0);
});

test("addSectionDefinition crea una sección custom con sus propios campos", () => {
  const db = createEmptyDatabase();
  const { db: next, section } = addSectionDefinition(db, {
    defaultTitle: "Hobbies",
    fields: [{ key: "name", label: "Hobby", type: "text", order: 0 }],
  });
  assert.equal(section.isCustom, true);
  assert.equal(section.fieldSchema.length, 1);
  assert.equal(next.sections.length, db.sections.length + 1);
});

test("addFieldToSection añade un campo sin tocar los ya existentes", () => {
  const db = createEmptyDatabase();
  const experience = db.sections.find((s) => s.key === "experience")!;
  const originalFieldCount = experience.fieldSchema.length;

  const next = addFieldToSection(db, experience.id, {
    key: "remote",
    label: "Remote",
    type: "boolean",
    order: originalFieldCount,
  });

  const updatedExperience = next.sections.find((s) => s.id === experience.id)!;
  assert.equal(updatedExperience.fieldSchema.length, originalFieldCount + 1);
  // Los campos originales siguen ahí, con los mismos keys.
  const originalKeys = experience.fieldSchema.map((f) => f.key);
  const newKeys = updatedExperience.fieldSchema.map((f) => f.key);
  for (const key of originalKeys) {
    assert.ok(newKeys.includes(key));
  }
});

test("las secciones estándar de una base de datos nueva siguen el orden canónico (Skills entre Summary y Experience)", () => {
  const db = createEmptyDatabase();
  const orderedKeys = [...db.sections].sort((a, b) => a.order - b.order).map((s) => s.key);
  assert.deepEqual(orderedKeys, [...STANDARD_SECTION_KEY_ORDER]);
});

test("STANDARD_SECTION_KEY_ORDER coincide exactamente con las keys que produce createEmptyDatabase (evita que ambas listas diverjan)", () => {
  const db = createEmptyDatabase();
  const keysInDb = new Set(db.sections.map((s) => s.key));
  assert.deepEqual(new Set(STANDARD_SECTION_KEY_ORDER), keysInDb);
});
