import test from "node:test";
import assert from "node:assert/strict";
import { sortReadingOrder, sortReadingOrderWithColumns } from "../readingOrder.js";
import type { ExtractedTextItem } from "../types.js";

function item(text: string, x: number, y: number, page = 1): ExtractedTextItem {
  return { text, x, y, page, fontSize: 8, fontName: "f1" };
}

test("ordena items ya en orden de lectura sin cambiarlos", () => {
  const items = [item("Uno", 10, 100), item("Dos", 10, 80), item("Tres", 10, 60)];
  const sorted = sortReadingOrder(items);
  assert.deepEqual(
    sorted.map((i) => i.text),
    ["Uno", "Dos", "Tres"]
  );
});

test("reordena de arriba a abajo cuando llegan en orden inverso", () => {
  const items = [item("Tres", 10, 60), item("Uno", 10, 100), item("Dos", 10, 80)];
  const sorted = sortReadingOrder(items);
  assert.deepEqual(
    sorted.map((i) => i.text),
    ["Uno", "Dos", "Tres"]
  );
});

test("dentro de una misma línea (Y similar), ordena de izquierda a derecha", () => {
  const items = [item("Derecha", 200, 100), item("Izquierda", 10, 101)];
  const sorted = sortReadingOrder(items);
  assert.deepEqual(
    sorted.map((i) => i.text),
    ["Izquierda", "Derecha"]
  );
});

test("respeta la tolerancia de Y: dos items con Y casi igual se consideran la misma línea", () => {
  const items = [item("B", 50, 99.5), item("A", 10, 100)];
  const sorted = sortReadingOrder(items, 2);
  assert.deepEqual(
    sorted.map((i) => i.text),
    ["A", "B"]
  );
});

test("nunca mezcla items de páginas distintas: página 1 completa antes que página 2", () => {
  const items = [item("Pagina2-arriba", 10, 500, 2), item("Pagina1-abajo", 10, 10, 1)];
  const sorted = sortReadingOrder(items);
  assert.deepEqual(
    sorted.map((i) => i.text),
    ["Pagina1-abajo", "Pagina2-arriba"]
  );
});

test("regresión: reproduce el patrón de un PDF real exportado por esta app, donde el " +
  "motor de impresión intercala título+cuerpo principal y subtítulo/fechas/contacto/tags " +
  "en dos 'pasadas' distintas dentro del content stream", () => {
  // Los mismos valores (x, y) que se comprobaron extrayendo un PDF exportado
  // por esta app: el orden bruto de pdf.js no es el orden visual.
  const items = [
    item("PERSONAL INFORMATION", 45, 789),
    item("Juan Lorente Guarnieri", 45, 770),
    item("EDUCATION", 45, 669),
    item("Computer Science", 45, 651),
    item("Computer Vision Engineer", 45, 759), // "segunda pasada": aparece muy tarde en el stream bruto
    item("sept 2020", 482, 651), // idem: la fecha de Education llega después de EDUCATION en el stream bruto
  ];
  const sorted = sortReadingOrder(items);
  assert.deepEqual(
    sorted.map((i) => i.text),
    [
      "PERSONAL INFORMATION",
      "Juan Lorente Guarnieri",
      "Computer Vision Engineer",
      "EDUCATION",
      "Computer Science",
      "sept 2020",
    ]
  );
});

test("sortReadingOrderWithColumns se comporta igual que sortReadingOrder cuando no hay columnas", () => {
  const items = [
    item("PERSONAL INFORMATION", 45, 789),
    item("Juan Lorente Guarnieri", 45, 770),
    item("EDUCATION", 45, 669),
  ];
  assert.deepEqual(
    sortReadingOrderWithColumns(items, 595).map((i) => i.text),
    sortReadingOrder(items).map((i) => i.text)
  );
});

test("sortReadingOrderWithColumns lee primero el sidebar y luego el cuerpo, cada uno en su propio orden vertical, en vez de intercalar ambas columnas por Y", () => {
  const items: ExtractedTextItem[] = [];
  let y = 800;
  for (let i = 0; i < 10; i++) {
    items.push({ ...item(`Skill ${i}`, 40, y), width: 60 });
    items.push({ ...item(`Exp ${i}`, 220, y), width: 300 });
    y -= 20;
  }
  const sorted = sortReadingOrderWithColumns(items, 595);
  const texts = sorted.map((i) => i.text);
  // Las 10 líneas del sidebar deben quedar todas seguidas (no intercaladas
  // 1 a 1 con el cuerpo, que es lo que haría un sort global por Y).
  const skillIndices = texts.map((t, idx) => (t.startsWith("Skill") ? idx : -1)).filter((i) => i >= 0);
  const expIndices = texts.map((t, idx) => (t.startsWith("Exp") ? idx : -1)).filter((i) => i >= 0);
  assert.ok(Math.max(...skillIndices) < Math.min(...expIndices));
  // Dentro de cada columna, el orden vertical se conserva (Skill 0 antes que Skill 9).
  assert.deepEqual(
    skillIndices.map((i) => texts[i]),
    Array.from({ length: 10 }, (_, i) => `Skill ${i}`)
  );
});
