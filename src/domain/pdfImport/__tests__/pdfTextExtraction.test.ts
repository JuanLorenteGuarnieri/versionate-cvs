import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { extractPdfText } from "../pdfTextExtraction.js";

/**
 * A diferencia de indexedDbStore.ts (Fase 2) o los componentes React, este
 * fichero SÍ se puede testear de verdad: pdf-lib genera un PDF real en
 * memoria, y pdfjs-dist lo lee de vuelta, todo dentro de Node, sin
 * navegador. Es la única pieza "externa" de todo el proyecto con una
 * prueba de integración de verdad en vez de solo un diagnóstico de tipos.
 */
async function makeSamplePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 en puntos
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  page.drawText("Jane Doe", { x: 50, y: 780, size: 20, font: bold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText("EXPERIENCE", { x: 50, y: 700, size: 14, font: bold });
  page.drawText("Software Engineer at Acme Corp", { x: 50, y: 675, size: 11, font });
  page.drawText("2020 - 2023", { x: 400, y: 675, size: 10, font });
  page.drawText("Built things and fixed bugs.", { x: 50, y: 655, size: 10, font });

  return doc.save();
}

test("extractPdfText extrae el texto de un PDF real, con posición y tamaño de fuente", async () => {
  const bytes = await makeSamplePdf();
  const result = await extractPdfText(bytes);

  assert.equal(result.numPages, 1);
  const texts = result.items.map((i) => i.text);
  assert.deepEqual(texts, [
    "Jane Doe",
    "EXPERIENCE",
    "Software Engineer at Acme Corp",
    "2020 - 2023",
    "Built things and fixed bugs.",
  ]);
});

test("el tamaño de fuente extraído coincide con el tamaño real usado al generar el PDF", async () => {
  const bytes = await makeSamplePdf();
  const result = await extractPdfText(bytes);

  const byText = new Map(result.items.map((i) => [i.text, i]));
  assert.ok(Math.abs(byText.get("Jane Doe")!.fontSize - 20) < 0.01);
  assert.ok(Math.abs(byText.get("EXPERIENCE")!.fontSize - 14) < 0.01);
  assert.ok(Math.abs(byText.get("Software Engineer at Acme Corp")!.fontSize - 11) < 0.01);
});

test("la posición extraída coincide con la posición real usada al generar el PDF", async () => {
  const bytes = await makeSamplePdf();
  const result = await extractPdfText(bytes);
  const byText = new Map(result.items.map((i) => [i.text, i]));

  const janeDoe = byText.get("Jane Doe")!;
  assert.ok(Math.abs(janeDoe.x - 50) < 0.01);
  assert.ok(Math.abs(janeDoe.y - 780) < 0.01);
});

test("las líneas vacías se descartan (no aparecen como items con texto en blanco)", async () => {
  const bytes = await makeSamplePdf();
  const result = await extractPdfText(bytes);
  assert.ok(result.items.every((i) => i.text.trim().length > 0));
});

test("el ancho/alto de página coincide con el tamaño A4 usado al crear el documento", async () => {
  const bytes = await makeSamplePdf();
  const result = await extractPdfText(bytes);
  assert.ok(Math.abs(result.pageWidth - 595.28) < 0.5);
  assert.ok(Math.abs(result.pageHeight - 841.89) < 0.5);
});

test("un PDF de varias páginas devuelve items de todas ellas, marcados con su número de página", async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page1 = doc.addPage([595.28, 841.89]);
  page1.drawText("Página uno", { x: 50, y: 800, size: 12, font });
  const page2 = doc.addPage([595.28, 841.89]);
  page2.drawText("Página dos", { x: 50, y: 800, size: 12, font });

  const bytes = await doc.save();
  const result = await extractPdfText(bytes);

  assert.equal(result.numPages, 2);
  assert.deepEqual(
    result.items.map((i) => [i.text, i.page]),
    [
      ["Página uno", 1],
      ["Página dos", 2],
    ]
  );
});

test("bytes que no son un PDF válido lanzan un error en vez de devolver algo a medias", async () => {
  const garbage = new Uint8Array([1, 2, 3, 4, 5]);
  await assert.rejects(() => extractPdfText(garbage));
});
