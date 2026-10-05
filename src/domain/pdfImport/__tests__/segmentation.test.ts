import test from "node:test";
import assert from "node:assert/strict";
import { detectHeadings, extractHeaderItems, splitIntoSections } from "../segmentation.js";
import type { ExtractedTextItem } from "../types.js";

function item(text: string, overrides: Partial<ExtractedTextItem> = {}): ExtractedTextItem {
  return { text, x: 0, y: 0, fontSize: 10, fontName: "f1", page: 1, ...overrides };
}

test("detecta cabeceras estándar en inglés", () => {
  const items = [item("Jane Doe"), item("EXPERIENCE"), item("Software Engineer"), item("EDUCATION"), item("BSc")];
  const headings = detectHeadings(items);
  assert.deepEqual(
    headings.map((h) => h.matchedSectionKey),
    ["experience", "education"]
  );
});

test("detecta cabeceras estándar en español, ignorando mayúsculas y acentos", () => {
  const items = [item("Experiencia Laboral"), item("algo"), item("EDUCACIÓN"), item("algo más")];
  const headings = detectHeadings(items);
  assert.deepEqual(
    headings.map((h) => h.matchedSectionKey),
    ["experience", "education"]
  );
});

test("ignora texto normal que no coincide con ninguna palabra clave", () => {
  const items = [item("Jane Doe"), item("jane@example.com"), item("Built cool things")];
  assert.deepEqual(detectHeadings(items), []);
});

test("tolera dos puntos o punto final en la cabecera", () => {
  const items = [item("Experience:"), item("algo")];
  const headings = detectHeadings(items);
  assert.equal(headings.length, 1);
  assert.equal(headings[0]!.matchedSectionKey, "experience");
});

test("no confunde una palabra que empieza igual pero significa otra cosa", () => {
  // "educations" no es una palabra real, pero sirve para comprobar que no
  // basta cualquier prefijo suelto de letras: debe ser la palabra completa
  // o la palabra clave seguida de un espacio.
  const items = [item("Educationally speaking, I know things")];
  assert.deepEqual(detectHeadings(items), []);
});

test("splitIntoSections agrupa los items entre cada cabecera y la siguiente", () => {
  const items = [
    item("Jane Doe"),
    item("EXPERIENCE"),
    item("Role A"),
    item("Company A"),
    item("EDUCATION"),
    item("Degree A"),
  ];
  const headings = detectHeadings(items);
  const chunks = splitIntoSections(items, headings);

  assert.equal(chunks.length, 2);
  assert.deepEqual(
    chunks[0]!.items.map((i) => i.text),
    ["Role A", "Company A"]
  );
  assert.deepEqual(
    chunks[1]!.items.map((i) => i.text),
    ["Degree A"]
  );
});

test("splitIntoSections con la última cabecera llega hasta el final de la lista", () => {
  const items = [item("EXPERIENCE"), item("A"), item("B"), item("C")];
  const chunks = splitIntoSections(items, detectHeadings(items));
  assert.deepEqual(
    chunks[0]!.items.map((i) => i.text),
    ["A", "B", "C"]
  );
});

test("sin ninguna cabecera detectada, splitIntoSections devuelve una lista vacía", () => {
  const items = [item("solo texto normal")];
  assert.deepEqual(splitIntoSections(items, detectHeadings(items)), []);
});

test("extractHeaderItems devuelve todo lo que hay antes de la primera cabecera (bug real: se descartaba)", () => {
  const items = [
    item("Jane Doe"),
    item("Senior Developer"),
    item("jane@example.com"),
    item("EXPERIENCE"),
    item("Role A"),
  ];
  const headings = detectHeadings(items);
  const header = extractHeaderItems(items, headings);
  assert.deepEqual(
    header.map((i) => i.text),
    ["Jane Doe", "Senior Developer", "jane@example.com"]
  );
});

test("extractHeaderItems no incluye nada de lo que ya cae dentro de una sección", () => {
  const items = [item("Jane Doe"), item("EXPERIENCE"), item("Role A")];
  const header = extractHeaderItems(items, detectHeadings(items));
  assert.deepEqual(
    header.map((i) => i.text),
    ["Jane Doe"]
  );
});

test("sin ninguna cabecera detectada, extractHeaderItems devuelve vacío (no asume que todo es la cabecera)", () => {
  const items = [item("solo texto normal, sin ninguna sección reconocible")];
  assert.deepEqual(extractHeaderItems(items, detectHeadings(items)), []);
});
