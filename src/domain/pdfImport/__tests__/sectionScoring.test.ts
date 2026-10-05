import test from "node:test";
import assert from "node:assert/strict";
import { detectHeadingCandidates } from "../sections/sectionScoring.js";
import type { ExtractedTextItem } from "../types.js";

function item(text: string, overrides: Partial<ExtractedTextItem> = {}): ExtractedTextItem {
  return { text, x: 50, y: 0, fontSize: 10, fontName: "f1", page: 1, ...overrides };
}

test("sin ninguna cabecera léxica confirmada, no añade nada (no inventa candidatos sin referencia de estilo)", () => {
  const items = [
    item("Just some random bold-looking text", { fontSize: 16, bold: true }),
    item("more body text", { fontSize: 10 }),
  ];
  assert.deepEqual(detectHeadingCandidates(items), []);
});

test("con cabeceras léxicas confirmadas, detecta OTRA línea con el MISMO estilo que el diccionario no reconoce", () => {
  const items = [
    item("Jane Doe", { fontSize: 20, bold: true }), // nombre, un tamaño único, no debe contar
    item("EXPERIENCE", { fontSize: 14, bold: true }),
    item("Software Engineer", { fontSize: 10 }),
    item("Professional Journey", { fontSize: 14, bold: true }), // heading no estándar, mismo estilo que EXPERIENCE
    item("More stuff", { fontSize: 10 }),
    item("EDUCATION", { fontSize: 14, bold: true }),
  ];
  const headings = detectHeadingCandidates(items);
  assert.deepEqual(
    headings.map((h) => [h.text, h.matchedSectionKey]),
    [
      ["EXPERIENCE", "experience"],
      ["Professional Journey", null],
      ["EDUCATION", "education"],
    ]
  );
});

test("no confunde un puesto en negrita dentro de Experience con una cabecera, aunque comparta tamaño", () => {
  // Dos entradas de Experience, cada una con su rol en negrita al mismo
  // tamaño que EXPERIENCE — esto NO debe generar candidatos falsos porque
  // el tamaño de rol (11pt) es distinto del tamaño real de cabecera (14pt).
  const items = [
    item("EXPERIENCE", { fontSize: 14, bold: true }),
    item("Senior Engineer", { fontSize: 11, bold: true }),
    item("desc", { fontSize: 10 }),
    item("Junior Engineer", { fontSize: 11, bold: true }),
    item("desc 2", { fontSize: 10 }),
  ];
  const headings = detectHeadingCandidates(items);
  assert.deepEqual(
    headings.map((h) => h.text),
    ["EXPERIENCE"]
  );
});

test("ignora una línea que comparte estilo pero tiene pinta de fecha, email o teléfono", () => {
  const items = [
    item("EXPERIENCE", { fontSize: 14, bold: true }),
    item("2020 - 2023", { fontSize: 14, bold: true }),
    item("jane@example.com", { fontSize: 14, bold: true }),
    item("EDUCATION", { fontSize: 14, bold: true }),
  ];
  const headings = detectHeadingCandidates(items);
  assert.deepEqual(
    headings.map((h) => h.text),
    ["EXPERIENCE", "EDUCATION"]
  );
});

test("no añade una línea larga o con muchas palabras aunque comparta estilo (no es un título de sección)", () => {
  const items = [
    item("EXPERIENCE", { fontSize: 14, bold: true }),
    item("This is a much longer sentence that just happens to be bold and 14pt too", { fontSize: 14, bold: true }),
    item("EDUCATION", { fontSize: 14, bold: true }),
  ];
  const headings = detectHeadingCandidates(items);
  assert.deepEqual(
    headings.map((h) => h.text),
    ["EXPERIENCE", "EDUCATION"]
  );
});
