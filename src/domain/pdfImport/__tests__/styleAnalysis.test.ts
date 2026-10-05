import test from "node:test";
import assert from "node:assert/strict";
import { analyzeStyle } from "../styleAnalysis.js";
import type { ExtractedPdfDocument, ExtractedTextItem } from "../types.js";

function item(overrides: Partial<ExtractedTextItem>): ExtractedTextItem {
  return { text: "x", x: 50, y: 700, fontSize: 10, fontName: "f1", page: 1, ...overrides };
}

function doc(items: ExtractedTextItem[], pageWidth = 595, pageHeight = 842): ExtractedPdfDocument {
  return { pageWidth, pageHeight, numPages: 1, items };
}

test("un documento vacío devuelve valores por defecto razonables, sin dividir por cero", () => {
  const style = analyzeStyle(doc([]));
  assert.equal(style.baseFontSize, 10.5);
  assert.ok(style.headingScale >= 1);
});

test("el tamaño base es el más frecuente entre los tamaños de cuerpo (no los títulos)", () => {
  const items = [
    item({ fontSize: 20 }), // título, una sola vez
    ...Array.from({ length: 10 }, () => item({ fontSize: 10 })), // cuerpo, mayoría
    ...Array.from({ length: 3 }, () => item({ fontSize: 11 })),
  ];
  const style = analyzeStyle(doc(items));
  assert.equal(style.baseFontSize, 10);
});

test("headingScale refleja la proporción entre el tamaño más grande y el de cuerpo", () => {
  const items = [item({ fontSize: 20 }), ...Array.from({ length: 5 }, () => item({ fontSize: 10 }))];
  const style = analyzeStyle(doc(items));
  assert.equal(style.headingScale, 2);
});

test("headingScale nunca baja de 1 ni sube de 2 (límites razonables)", () => {
  const sameSizeItems = Array.from({ length: 5 }, () => item({ fontSize: 10 }));
  assert.ok(analyzeStyle(doc(sameSizeItems)).headingScale >= 1);

  const extremeItems = [item({ fontSize: 100 }), ...Array.from({ length: 5 }, () => item({ fontSize: 10 }))];
  assert.ok(analyzeStyle(doc(extremeItems)).headingScale <= 2);
});

test("los márgenes se derivan de la posición del texto respecto al tamaño de página", () => {
  // Página de 595x842pt, texto pegado a 50pt del borde izquierdo y a 100pt del superior.
  const items = Array.from({ length: 5 }, () => item({ x: 50, y: 742 })); // 842-742=100pt desde arriba
  const style = analyzeStyle(doc(items, 595, 842));
  // 50pt ≈ 17.6mm, 100pt ≈ 35.3mm
  assert.ok(Math.abs(style.margins.left - 18) <= 1);
  assert.ok(Math.abs(style.margins.top - 35) <= 1);
});

test("los márgenes nunca son negativos ni absurdamente pequeños (mínimo razonable)", () => {
  const items = [item({ x: 0, y: 842 })]; // texto pegado literalmente al borde
  const style = analyzeStyle(doc(items));
  assert.ok(style.margins.left >= 5);
  assert.ok(style.margins.top >= 5);
});

test("regresión: los márgenes usan el extremo del texto, no su posición típica (bug real de importación)", () => {
  // La mayoría del texto (cuerpo del CV) vive mucho más metido hacia el
  // centro de la página que el margen real; antes se usaba la mediana de
  // TODOS los items, que caía cerca de esa posición "típica" del cuerpo, no
  // del borde real de la página — dando márgenes varias veces mayores que
  // los reales. Aquí el margen real es de 50pt (~17.6mm), pero el cuerpo
  // del texto vive indentado a 50-200pt del borde izquierdo.
  const items = [
    item({ x: 50, y: 800 }), // encabezado, pegado al margen real
    ...Array.from({ length: 20 }, (_, i) => item({ x: 90 + i * 5, y: 700 - i * 12 })), // cuerpo, indentado
  ];
  const style = analyzeStyle(doc(items, 595, 842));
  // 50pt ≈ 17.6mm — con la mediana antigua habría dado bastante más de 30mm.
  assert.ok(style.margins.left < 25, `left margin demasiado grande: ${style.margins.left}mm`);
});

test("headingScale usa el tamaño de título que se REPITE, no el mayor de todo el documento", () => {
  // Un caso realista: el nombre del CV se pinta una sola vez a 24pt, pero
  // los títulos de sección (que se repiten) están a 13pt sobre un cuerpo de
  // 10pt. headingScale debe reflejar 13/10, no 24/10 (que generaría títulos
  // de sección desproporcionadamente grandes en la template propuesta).
  const items = [
    item({ fontSize: 24 }), // nombre, una sola vez
    ...Array.from({ length: 6 }, () => item({ fontSize: 13 })), // títulos de sección, repetidos
    ...Array.from({ length: 20 }, () => item({ fontSize: 10 })), // cuerpo, mayoría
  ];
  const style = analyzeStyle(doc(items));
  assert.equal(style.baseFontSize, 10);
  assert.ok(
    Math.abs(style.headingScale - 1.3) < 0.05,
    `headingScale debería acercarse a 1.3 (13/10), fue ${style.headingScale}`
  );
});
