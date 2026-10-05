import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDatabase } from "../database.js";
import { createTemplate, forkTemplate, updateTemplate } from "../templates.js";

test("createTemplate crea un template con valores base razonables", () => {
  const db = createEmptyDatabase();
  const { db: next, template } = createTemplate(db, { name: "Minimal Dark" });
  assert.equal(template.name, "Minimal Dark");
  assert.equal(template.derivedFromTemplateId, null);
  assert.equal(next.templates.length, 1);
});

test("updateTemplate (Save) muta el template in-place, afectando a todo lo que lo use", () => {
  const db = createEmptyDatabase();
  const { db: withTemplate, template } = createTemplate(db, { name: "Minimal Dark" });
  const { db: next, template: updated } = updateTemplate(withTemplate, template.id, {
    colors: { ...template.colors, accent: "#ff0000" },
  });
  assert.equal(updated.id, template.id);
  assert.equal(next.templates.length, 1, "sigue siendo el mismo template, no se duplica");
  assert.equal(next.templates[0]!.colors.accent, "#ff0000");
});

test("forkTemplate (Save as new template) bifurca sin tocar el original (§10 del contexto)", () => {
  const db = createEmptyDatabase();
  const { db: withTemplate, template } = createTemplate(db, { name: "Minimal Dark" });
  const { db: next, template: forked } = forkTemplate(withTemplate, template.id, "Minimal Dark - Bold", {
    typography: { ...template.typography, baseFontSize: 12 },
  });

  assert.notEqual(forked.id, template.id);
  assert.equal(forked.derivedFromTemplateId, template.id);
  assert.equal(next.templates.length, 2);

  const original = next.templates.find((t) => t.id === template.id)!;
  assert.equal(original.typography.baseFontSize, template.typography.baseFontSize, "el original no cambia");
  assert.equal(forked.typography.baseFontSize, 12);
  assert.equal(forked.colors.accent, template.colors.accent, "hereda lo no sobreescrito");
});
