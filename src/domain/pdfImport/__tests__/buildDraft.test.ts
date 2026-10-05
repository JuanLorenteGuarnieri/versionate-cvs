import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractPdfText } from "../pdfTextExtraction.js";
import { buildImportDraft } from "../buildDraft.js";

/**
 * El test más importante de todo el pipeline de importación: de bytes
 * reales de un PDF (generados aquí mismo con pdf-lib) a un borrador
 * estructurado completo, pasando por CADA etapa real (extracción con
 * pdf.js, segmentación, agrupación en entradas, mapeo de campos, análisis
 * de estilo) sin ningún mock ni fixture inventado a mano.
 */
async function makeRealisticCvPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = 780;
  const header = (text: string) => {
    page.drawText(text, { x: 50, y, size: 20, font: bold });
    y -= 40;
  };
  const heading = (text: string) => {
    page.drawText(text, { x: 50, y, size: 14, font: bold });
    y -= 25;
  };
  const line = (text: string, size = 11) => {
    page.drawText(text, { x: 50, y, size, font });
    y -= 18;
  };
  const gap = (amount: number) => {
    y -= amount;
  };

  header("Jane Doe");

  heading("EXPERIENCE");
  line("Software Engineer at Acme Corp (2020 - 2023)");
  line("Built things and fixed bugs.");
  gap(25);
  line("Intern at Startup Inc (2019 - 2019)");
  line("Learned a lot.");
  gap(35);

  heading("EDUCATION");
  line("BSc Computer Science (2016 - 2020)");

  return doc.save();
}

test("el pipeline completo produce secciones reconocidas con sus entradas correctamente pobladas", async () => {
  const bytes = await makeRealisticCvPdf();
  const extracted = await extractPdfText(bytes);
  const draft = buildImportDraft(extracted);

  // 3, no 2: el bloque de cabecera ("Jane Doe", antes de EXPERIENCE) ahora
  // se captura como su propia sección de datos personales en vez de
  // descartarse — ver regresión más abajo y personalInfoMapping.test.ts.
  assert.equal(draft.sections.length, 3);

  const personalInfo = draft.sections[0]!;
  assert.equal(personalInfo.matchedSectionKey, "personal-information");
  assert.equal(personalInfo.entries.length, 1);
  assert.deepEqual(personalInfo.entries[0]!.rawLines, ["Jane Doe"]);

  const experience = draft.sections[1]!;
  assert.equal(experience.matchedSectionKey, "experience");
  assert.equal(experience.entries.length, 2);
  assert.equal(experience.entries[0]!.titleGuess, "Software Engineer at Acme Corp ()");
  assert.deepEqual(experience.entries[0]!.dateRange, { start: "2020-01-01", end: "2023-01-01" });
  assert.equal(experience.entries[0]!.descriptionGuess, "Built things and fixed bugs.");
  assert.equal(experience.entries[1]!.titleGuess, "Intern at Startup Inc ()");

  const education = draft.sections[2]!;
  assert.equal(education.matchedSectionKey, "education");
  assert.equal(education.entries.length, 1);
  assert.equal(education.entries[0]!.titleGuess, "BSc Computer Science ()");
});

test("regresión: el bloque de cabecera (nombre, contacto...) ya no se descarta silenciosamente", async () => {
  // Antes de este fix, TODO el texto antes de la primera cabecera
  // reconocida se perdía sin más — en la inmensa mayoría de CVs reales eso
  // es justo el nombre y los datos de contacto, que nunca llegaban ni
  // siquiera a la pantalla de revisión.
  const bytes = await makeRealisticCvPdf();
  const extracted = await extractPdfText(bytes);
  const draft = buildImportDraft(extracted);
  const personalInfo = draft.sections.find((s) => s.matchedSectionKey === "personal-information");
  assert.ok(personalInfo, "debe existir una sección de datos personales");
  assert.ok(personalInfo!.entries[0]!.rawLines.includes("Jane Doe"));
});

test("el pipeline completo también propone un estilo coherente con el PDF generado", async () => {
  const bytes = await makeRealisticCvPdf();
  const extracted = await extractPdfText(bytes);
  const draft = buildImportDraft(extracted);

  // Cuerpo a 11pt (mayoritario), títulos de sección a 14pt -> headingScale ~14/11.
  assert.equal(draft.styleProposal.baseFontSize, 11);
  assert.ok(draft.styleProposal.headingScale > 1);
  assert.ok(draft.styleProposal.margins.left > 0);
});

/**
 * Regresión de un bug real: al reimportar un PDF exportado por esta misma
 * app, casi toda la información (subtítulo del header, fechas, contacto,
 * tags) acababa en la sección equivocada. La causa: el motor de impresión
 * de Chromium no escribe el content stream del PDF en orden visual — dibuja
 * primero una "pasada" con títulos/cuerpo principal y solo después otra
 * pasada con subtítulos/fechas/meta de TODAS las secciones. Aquí se
 * reproduce ese mismo patrón con pdf-lib (dibujando el subtítulo del header
 * y la fecha de EDUCATION al final, fuera de orden visual) para comprobar
 * que el pipeline sigue asignando cada cosa a su sección correcta.
 */
async function makeOutOfOrderCvPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // "Primera pasada": título principal + cabeceras + cuerpo, de arriba a
  // abajo, SIN la fecha de educación ni el subtítulo del header (llegan
  // después, fuera de orden, como en el PDF real).
  page.drawText("Jane Doe", { x: 50, y: 780, size: 20, font: bold });
  page.drawText("EDUCATION", { x: 50, y: 740, size: 14, font: bold });
  page.drawText("BSc Computer Science", { x: 50, y: 715, size: 11, font });
  page.drawText("EXPERIENCE", { x: 50, y: 680, size: 14, font: bold });
  page.drawText("Software Engineer", { x: 50, y: 655, size: 11, font });

  // "Segunda pasada": llega DESPUÉS en el content stream aunque
  // visualmente pertenece a líneas ya dibujadas arriba.
  page.drawText("Senior Developer", { x: 50, y: 796, size: 11, font }); // subtítulo bajo "Jane Doe"
  page.drawText("2016 - 2020", { x: 400, y: 740, size: 10, font }); // misma línea que "EDUCATION"... no, misma Y que la cabecera
  page.drawText("2020 - 2023", { x: 400, y: 655, size: 10, font }); // misma línea que "Software Engineer"

  return doc.save();
}

test("regresión: asigna correctamente el contenido aunque el PDF no esté en orden de lectura en el content stream", async () => {
  const bytes = await makeOutOfOrderCvPdf();
  const extracted = await extractPdfText(bytes);
  const draft = buildImportDraft(extracted);

  // 3, no 2: incluye también la sección de datos personales capturada del
  // bloque de cabecera ("Jane Doe", antes de la primera cabecera real).
  assert.equal(draft.sections.length, 3);

  const education = draft.sections.find((s) => s.matchedSectionKey === "education")!;
  assert.ok(education, "la sección EDUCATION debe existir");
  assert.equal(education.entries.length, 1);
  assert.match(education.entries[0]!.titleGuess, /BSc Computer Science/);
  assert.deepEqual(education.entries[0]!.dateRange, { start: "2016-01-01", end: "2020-01-01" });

  const experience = draft.sections.find((s) => s.matchedSectionKey === "experience")!;
  assert.ok(experience, "la sección EXPERIENCE debe existir");
  assert.equal(experience.entries.length, 1);
  assert.match(experience.entries[0]!.titleGuess, /Software Engineer/);
  assert.deepEqual(experience.entries[0]!.dateRange, { start: "2020-01-01", end: "2023-01-01" });
});

test("un PDF sin ninguna cabecera reconocible da un borrador sin secciones, sin reventar", async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("Just some random text without any known heading.", { x: 50, y: 780, size: 11, font });
  const bytes = await doc.save();

  const extracted = await extractPdfText(bytes);
  const draft = buildImportDraft(extracted);
  assert.deepEqual(draft.sections, []);
});
