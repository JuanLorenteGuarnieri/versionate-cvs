import test from "node:test";
import assert from "node:assert/strict";
import { detectColumnSplit, splitIntoColumnRegions } from "../classification/columnDetection.js";
import type { ExtractedTextItem } from "../types.js";

const PAGE_WIDTH = 595;

function item(text: string, x: number, y: number, width = text.length * 5): ExtractedTextItem {
  return { text, x, y, width, fontSize: 10, fontName: "f1", page: 1 };
}

/** Sidebar izquierdo (contacto/skills) + cuerpo principal a la derecha, muchas líneas, gutter estable. */
function twoColumnItems(): ExtractedTextItem[] {
  const items: ExtractedTextItem[] = [];
  let y = 800;
  for (let i = 0; i < 10; i++) {
    items.push(item(`Skill ${i}`, 40, y, 60)); // columna izquierda: 40-100
    items.push(item(`Experience line ${i} with more text`, 220, y, 300)); // columna derecha: 220-520
    y -= 20;
  }
  return items;
}

test("detectColumnSplit no encuentra columnas en un CV normal de una sola columna", () => {
  const items = Array.from({ length: 10 }, (_, i) => item(`Line number ${i} of a normal cv`, 50, 800 - i * 15, 300));
  assert.equal(detectColumnSplit(items, PAGE_WIDTH), null);
});

test("detectColumnSplit encuentra un gutter estable con un sidebar real de varias líneas", () => {
  const gutter = detectColumnSplit(twoColumnItems(), PAGE_WIDTH);
  assert.ok(gutter !== null);
  assert.ok(gutter! > 100 && gutter! < 220);
});

test("detectColumnSplit ignora huecos puntuales (una fecha alineada a la derecha en una única línea)", () => {
  const items = [
    ...Array.from({ length: 8 }, (_, i) => item(`Body line ${i} of normal prose text`, 50, 800 - i * 15, 300)),
    item("2020 - 2023", 450, 800), // una sola línea con un hueco grande, no repetido
  ];
  assert.equal(detectColumnSplit(items, PAGE_WIDTH), null);
});

test("detectColumnSplit exige contenido sustancial en ambos lados, no un membrete puntual", () => {
  const items = [
    ...Array.from({ length: 8 }, (_, i) => item(`Body line ${i} of normal prose text here`, 50, 800 - i * 15, 300)),
    item("p.1", 560, 800), // una sola marca a la derecha, no una columna real
  ];
  assert.equal(detectColumnSplit(items, PAGE_WIDTH), null);
});

test("splitIntoColumnRegions devuelve una sola región cuando no hay columnas", () => {
  const items = Array.from({ length: 5 }, (_, i) => item(`Line ${i}`, 50, 800 - i * 15, 100));
  const regions = splitIntoColumnRegions(items, PAGE_WIDTH);
  assert.equal(regions.length, 1);
  assert.equal(regions[0]!.items.length, 5);
});

test("splitIntoColumnRegions separa items de cada lado del gutter en dos columnas reales", () => {
  const regions = splitIntoColumnRegions(twoColumnItems(), PAGE_WIDTH);
  assert.equal(regions.length, 2);
  assert.ok(regions[0]!.items.every((i) => i.text.startsWith("Skill")));
  assert.ok(regions[1]!.items.every((i) => i.text.startsWith("Experience")));
});
