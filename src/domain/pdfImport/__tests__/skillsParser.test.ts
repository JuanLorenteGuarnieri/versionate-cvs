import test from "node:test";
import assert from "node:assert/strict";
import { extractSkillsFields } from "../entries/skillsParser.js";
import type { SectionDefinition } from "../../model/types.js";

function skillsSection(): SectionDefinition {
  return {
    key: "skills",
    defaultTitle: "Skills",
    fieldSchema: [
      { key: "programmingLanguages", label: "Programming Languages", type: "tags", order: 0 },
      { key: "technologies", label: "Technologies", type: "tags", order: 1 },
      { key: "softSkills", label: "Soft Skills", type: "tags", order: 2 },
    ],
  } as unknown as SectionDefinition;
}

test("clasifica correctamente líneas con etiqueta explícita", () => {
  const fields = extractSkillsFields(
    ["Programming Languages: Python, Java, TypeScript", "Tools: Docker, Git, Kubernetes", "Soft Skills: Leadership, Communication"],
    skillsSection()
  );
  assert.deepEqual(fields.programmingLanguages, ["Python", "Java", "TypeScript"]);
  assert.deepEqual(fields.technologies, ["Docker", "Git", "Kubernetes"]);
  assert.deepEqual(fields.softSkills, ["Leadership", "Communication"]);
});

test("sin etiquetas, clasifica por diccionario: lenguajes conocidos vs el resto", () => {
  const fields = extractSkillsFields(["Python", "Docker", "JavaScript", "Kubernetes"], skillsSection());
  assert.deepEqual(fields.programmingLanguages, ["Python", "JavaScript"]);
  assert.deepEqual(fields.technologies, ["Docker", "Kubernetes"]);
});

test("nunca descarta un token desconocido: cae en technologies por defecto", () => {
  const fields = extractSkillsFields(["SomeVeryObscureToolNoOneHasHeardOf"], skillsSection());
  assert.deepEqual(fields.technologies, ["SomeVeryObscureToolNoOneHasHeardOf"]);
});

test("reconoce soft skills del diccionario incluso sin etiqueta", () => {
  const fields = extractSkillsFields(["Leadership, Teamwork, Docker"], skillsSection());
  assert.deepEqual(fields.softSkills, ["Leadership", "Teamwork"]);
  assert.deepEqual(fields.technologies, ["Docker"]);
});

test("deduplica tokens repetidos conservando el primer casing", () => {
  const fields = extractSkillsFields(["Python, python, PYTHON"], skillsSection());
  assert.deepEqual(fields.programmingLanguages, ["Python"]);
});

test("con una sección custom de un solo campo de tags, todo va junto sin perder nada", () => {
  const section = {
    key: "custom-skills",
    defaultTitle: "My skills",
    fieldSchema: [{ key: "items", label: "Items", type: "tags", order: 0 }],
  } as unknown as SectionDefinition;
  const fields = extractSkillsFields(["Python, Docker, Leadership"], section);
  assert.deepEqual(fields.items, ["Python", "Docker", "Leadership"]);
});
