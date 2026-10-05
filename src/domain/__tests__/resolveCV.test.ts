import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDatabase } from "../database.js";
import { createTemplate } from "../templates.js";
import { createCVProject, setSectionItems } from "../cv.js";
import { createElement } from "../variants.js";
import { moveVariantToTrash } from "../trash.js";
import { getVisibleSections, resolveCV } from "../resolveCV.js";

function seedFullCV() {
  let db = createEmptyDatabase();
  const templateResult = createTemplate(db, { name: "Minimal Dark" });
  db = templateResult.db;

  const projectsSection = db.sections.find((s) => s.key === "projects")!;
  const educationSection = db.sections.find((s) => s.key === "education")!;

  const elementResult = createElement(db, {
    sectionId: projectsSection.id,
    variantName: "Original",
    fields: { title: "Scanpath Prediction", technologies: ["Python", "PyTorch"] },
  });
  db = elementResult.db;

  const cvResult = createCVProject(db, { name: "CV", templateId: templateResult.template.id });
  db = setSectionItems(cvResult.db, cvResult.version.id, projectsSection.id, [
    { elementId: elementResult.element.id, variantId: elementResult.variant.id },
  ]);
  // Education se deja explícitamente sin items.
  db = setSectionItems(db, cvResult.version.id, educationSection.id, []);

  return {
    db,
    template: templateResult.template,
    projectsSection,
    educationSection,
    element: elementResult.element,
    variant: elementResult.variant,
    cvVersion: cvResult.version,
  };
}

test("resolveCV resuelve los campos de la variante seleccionada según el fieldSchema de la sección", () => {
  const { db, cvVersion, projectsSection } = seedFullCV();
  const resolved = resolveCV(db, cvVersion.id);

  const projectsResolved = resolved.sections.find((s) => s.sectionDefinitionId === projectsSection.id)!;
  assert.equal(projectsResolved.items.length, 1);
  const titleField = projectsResolved.items[0]!.fields.find((f) => f.key === "title")!;
  assert.equal(titleField.value, "Scanpath Prediction");
  const techField = projectsResolved.items[0]!.fields.find((f) => f.key === "technologies")!;
  assert.deepEqual(techField.value, ["Python", "PyTorch"]);
});

test("una sección sin items resolubles tiene hasVisibleContent=false y desaparece con getVisibleSections (§8)", () => {
  const { db, cvVersion, educationSection } = seedFullCV();
  const resolved = resolveCV(db, cvVersion.id);

  const educationResolved = resolved.sections.find((s) => s.sectionDefinitionId === educationSection.id)!;
  assert.equal(educationResolved.hasVisibleContent, false);

  const visible = getVisibleSections(resolved);
  assert.ok(
    !visible.some((s) => s.sectionDefinitionId === educationSection.id),
    "Education no debe aparecer ni en preview ni en PDF"
  );
});

test("un item con referencia rota se marca como broken y se excluye de getVisibleSections", () => {
  const { db, cvVersion, projectsSection, variant } = seedFullCV();
  const withTrash = moveVariantToTrash(db, variant.id); // cascada: variante + elemento a papelera

  const resolved = resolveCV(withTrash, cvVersion.id);
  const projectsResolved = resolved.sections.find((s) => s.sectionDefinitionId === projectsSection.id)!;
  assert.equal(projectsResolved.items[0]!.broken, true);
  assert.equal(projectsResolved.hasVisibleContent, false, "sin items válidos, la sección deja de ser visible");

  const visible = getVisibleSections(resolved);
  assert.ok(!visible.some((s) => s.sectionDefinitionId === projectsSection.id));
});

test("resolveCV soporta un template borrado devolviendo template: null en vez de fallar", () => {
  const { db, cvVersion } = seedFullCV();
  const dbWithoutTemplates = { ...db, templates: [] };
  const resolved = resolveCV(dbWithoutTemplates, cvVersion.id);
  assert.equal(resolved.template, null);
  assert.equal(resolved.templateId, cvVersion.templateId, "conserva el id para poder avisar en la UI");
});

test("resolveCV lanza un error claro si la versión no existe", () => {
  const { db } = seedFullCV();
  assert.throws(() => resolveCV(db, "version-inexistente"), /CVVersion not found/);
});
