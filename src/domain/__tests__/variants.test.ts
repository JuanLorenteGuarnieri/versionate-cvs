import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDatabase } from "../database.js";
import { createElement, forkVariant, renameElement, renameVariant, setDefaultVariant, updateVariant } from "../variants.js";

function seedProjectElement() {
  const db = createEmptyDatabase();
  const projectsSection = db.sections.find((s) => s.key === "projects")!;
  return createElement(db, {
    sectionId: projectsSection.id,
    variantName: "Original",
    fields: { title: "Scanpath Prediction", description: null, technologies: ["Python"] },
  });
}

test("createElement crea el elemento con su primera variante, sin trato especial (§5)", () => {
  const { db, element, variant } = seedProjectElement();
  assert.equal(element.variantIds.length, 1);
  assert.equal(element.variantIds[0], variant.id);
  assert.equal(element.defaultVariantId, variant.id);
  assert.equal(db.variants.length, 1);
  assert.equal(db.elements.length, 1);
  assert.equal(db.history.length, 1);
  assert.equal(db.history[0]!.type, "element_created");
});

test("updateVariant (Save) muta la variante in-place", () => {
  const { db, variant } = seedProjectElement();
  const { db: next, variant: updated } = updateVariant(db, variant.id, {
    title: "Scanpath Prediction (updated)",
  });
  assert.equal(updated.id, variant.id, "el id no cambia: es la misma variante");
  assert.equal(next.variants.length, 1, "no se crea ninguna variante nueva");
  assert.equal(next.variants[0]!.fields.title, "Scanpath Prediction (updated)");
});

test("forkVariant (Save as variant) crea una variante nueva sin tocar la original", () => {
  const { db, element, variant } = seedProjectElement();
  const { db: next, variant: forked } = forkVariant(db, variant.id, "Computer Vision", {
    technologies: ["Python", "PyTorch"],
  });

  assert.notEqual(forked.id, variant.id);
  assert.equal(forked.derivedFromVariantId, variant.id);
  assert.equal(forked.elementId, element.id);

  const original = next.variants.find((v) => v.id === variant.id)!;
  assert.deepEqual(original.fields.technologies, ["Python"], "la original no cambia");
  assert.deepEqual(forked.fields.technologies, ["Python", "PyTorch"]);
  assert.equal(forked.fields.title, "Scanpath Prediction", "hereda los campos no sobreescritos");

  const updatedElement = next.elements.find((e) => e.id === element.id)!;
  assert.deepEqual(updatedElement.variantIds, [variant.id, forked.id]);
  assert.equal(
    updatedElement.defaultVariantId,
    variant.id,
    "forkVariant no cambia la variante por defecto"
  );
});

test("setDefaultVariant cambia solo la conveniencia de UI, no crea ni borra nada", () => {
  const { db, element, variant } = seedProjectElement();
  const { db: withFork, variant: forked } = forkVariant(db, variant.id, "Computer Vision");
  const next = setDefaultVariant(withFork, element.id, forked.id);
  assert.equal(next.elements.find((e) => e.id === element.id)!.defaultVariantId, forked.id);
  assert.equal(next.variants.length, 2, "no cambia el número de variantes");
});

test("setDefaultVariant lanza error si la variante no pertenece al elemento", () => {
  const { db, element } = seedProjectElement();
  assert.throws(() => setDefaultVariant(db, element.id, "id-inexistente"));
});

test("renameVariant cambia el nombre sin tocar los campos (antes solo se podía poner al bifurcar)", () => {
  const { db, variant } = seedProjectElement();
  const { db: renamed, variant: updated } = renameVariant(db, variant.id, "Computer Vision - Robotics");
  assert.equal(updated.name, "Computer Vision - Robotics");
  assert.deepEqual(updated.fields, variant.fields);
  assert.equal(renamed.variants.find((v) => v.id === variant.id)!.name, "Computer Vision - Robotics");
});

test("renameVariant recorta espacios y rechaza un nombre vacío", () => {
  const { db, variant } = seedProjectElement();
  const { variant: updated } = renameVariant(db, variant.id, "  Con espacios  ");
  assert.equal(updated.name, "Con espacios");
  assert.throws(() => renameVariant(db, variant.id, "   "), /vacío/);
});

test(
  "renameElement fija un nombre explícito para el elemento, independiente del campo de título " +
    "de la variante (petición explícita: se quedaba 'pegado' al primer nombre dado)",
  () => {
    const { db, element } = seedProjectElement();
    const { db: renamed, element: updated } = renameElement(db, element.id, "Mi proyecto estrella");
    assert.equal(updated.labelOverride, "Mi proyecto estrella");
    assert.equal(renamed.elements.find((e) => e.id === element.id)!.labelOverride, "Mi proyecto estrella");
  }
);

test("renameElement con una cadena vacía SÍ es válido: quita el override y vuelve a la adivinanza automática", () => {
  const { db, element } = seedProjectElement();
  const { db: renamed } = renameElement(db, element.id, "Mi proyecto estrella");
  const { db: cleared, element: updated } = renameElement(renamed, element.id, "   ");
  assert.equal(updated.labelOverride, undefined);
  assert.equal(cleared.elements.find((e) => e.id === element.id)!.labelOverride, undefined);
});

test("renameElement no toca los campos ni las variantes del elemento", () => {
  const { db, element, variant } = seedProjectElement();
  const { db: renamed } = renameElement(db, element.id, "Mi proyecto estrella");
  assert.deepEqual(renamed.variants.find((v) => v.id === variant.id)!.fields, variant.fields);
});
