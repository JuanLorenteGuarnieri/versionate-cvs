import test from "node:test";
import assert from "node:assert/strict";
import { detectRepeatedHeaderFooterLines, stripRepeatedHeaderFooterLines } from "../classification/headerFooterDetection.js";
import type { ExtractedTextItem } from "../types.js";

function item(text: string, x: number, y: number, page: number): ExtractedTextItem {
  return { text, x, y, fontSize: 10, fontName: "f1", page };
}

const PAGE_HEIGHT = 842;

test("no toca nada en un documento de una sola página", () => {
  const items = [item("Jane Doe - CV", 50, 820, 1), item("Experience", 50, 700, 1)];
  assert.equal(detectRepeatedHeaderFooterLines(items, PAGE_HEIGHT, 1).size, 0);
});

test("detecta un pie de página repetido en la misma posición en varias páginas", () => {
  const items = [
    item("Experience", 50, 700, 1),
    item("Jane Doe - page 1", 50, 20, 1),
    item("Education", 50, 700, 2),
    item("Jane Doe - page 2", 50, 20, 2),
  ];
  // Los textos son distintos ("page 1" vs "page 2"), así que en este caso
  // concreto NO deben detectarse como repetidos (el criterio exige mismo
  // texto normalizado) — se comprueba el caso positivo real a continuación.
  const removed = detectRepeatedHeaderFooterLines(items, PAGE_HEIGHT, 2);
  assert.equal(removed.size, 0);
});

test("detecta y elimina un encabezado idéntico repetido en la misma posición Y en 2+ páginas", () => {
  const items = [
    item("Jane Doe - Curriculum Vitae", 50, 820, 1),
    item("Experience", 50, 700, 1),
    item("Role A", 50, 680, 1),
    item("Jane Doe - Curriculum Vitae", 50, 820, 2),
    item("Education", 50, 700, 2),
  ];
  const filtered = stripRepeatedHeaderFooterLines(items, PAGE_HEIGHT, 2);
  assert.deepEqual(
    filtered.map((i) => i.text),
    ["Experience", "Role A", "Education"]
  );
});

test("no elimina texto repetido si NO está en la misma posición vertical (p.ej. la misma palabra en dos sitios distintos)", () => {
  const items = [
    item("Node.js", 50, 700, 1), // skill en página 1
    item("Node.js", 300, 300, 2), // tecnología mencionada en un proyecto de página 2, posición distinta
  ];
  const removed = detectRepeatedHeaderFooterLines(items, PAGE_HEIGHT, 2);
  assert.equal(removed.size, 0);
});

test("un texto que aparece dos veces en la MISMA página no cuenta como header/footer (necesita páginas distintas)", () => {
  const items = [item("Present", 50, 700, 1), item("Present", 400, 600, 1)];
  const removed = detectRepeatedHeaderFooterLines(items, PAGE_HEIGHT, 2);
  assert.equal(removed.size, 0);
});
