import test from "node:test";
import assert from "node:assert/strict";
import { plainTextToRichText, richTextToPlainText } from "../richtext.js";

test("richTextToPlainText de null/undefined da string vacío", () => {
  assert.equal(richTextToPlainText(null), "");
  assert.equal(richTextToPlainText(undefined), "");
});

test("round-trip de texto simple, sin formato", () => {
  const text = "Primera línea\nSegunda línea";
  const doc = plainTextToRichText(text);
  assert.equal(richTextToPlainText(doc), text);
});

test("plainTextToRichText('') produce un documento válido que vuelve a dar ''", () => {
  const doc = plainTextToRichText("");
  assert.equal(doc.blocks.length, 1);
  assert.equal(richTextToPlainText(doc), "");
});

test("richTextToPlainText concatena varios runs dentro del mismo bloque, marcando negrita con asteriscos para poder volver a editarlo", () => {
  const doc = { type: "richtext" as const, blocks: [{ kind: "paragraph" as const, runs: [{ text: "Hola " }, { text: "mundo", bold: true }] }] };
  assert.equal(richTextToPlainText(doc), "Hola *mundo*");
});

test("plainTextToRichText reconoce *negrita* (un asterisco) dentro de una línea", () => {
  const doc = plainTextToRichText("Hola *mundo* que tal");
  assert.deepEqual(doc.blocks[0]!.runs, [{ text: "Hola " }, { text: "mundo", bold: true }, { text: " que tal" }]);
});

test("plainTextToRichText reconoce **cursiva** (dos asteriscos) dentro de una línea", () => {
  const doc = plainTextToRichText("Hola **mundo** que tal");
  assert.deepEqual(doc.blocks[0]!.runs, [{ text: "Hola " }, { text: "mundo", italic: true }, { text: " que tal" }]);
});

test("plainTextToRichText distingue negrita y cursiva en la misma línea", () => {
  const doc = plainTextToRichText("*negrita* y **cursiva** juntas");
  assert.deepEqual(doc.blocks[0]!.runs, [
    { text: "negrita", bold: true },
    { text: " y " },
    { text: "cursiva", italic: true },
    { text: " juntas" },
  ]);
});

test("round-trip de negrita y cursiva: convertir a rich text y otra vez a texto plano da lo mismo", () => {
  const text = "Una línea con *negrita* y **cursiva** mezcladas";
  const doc = plainTextToRichText(text);
  assert.equal(richTextToPlainText(doc), text);
});

test("plainTextToRichText reconoce '· ' al principio de línea como bullet", () => {
  const doc = plainTextToRichText("Texto normal\n· Primer punto\n· Segundo punto");
  assert.equal(doc.blocks[0]!.kind, "paragraph");
  assert.equal(doc.blocks[1]!.kind, "bullet");
  assert.deepEqual(doc.blocks[1]!.runs, [{ text: "Primer punto" }]);
  assert.equal(doc.blocks[2]!.kind, "bullet");
  assert.deepEqual(doc.blocks[2]!.runs, [{ text: "Segundo punto" }]);
});

test("un bullet puede llevar también *negrita*/**cursiva** dentro", () => {
  const doc = plainTextToRichText("· Con *negrita* dentro");
  assert.equal(doc.blocks[0]!.kind, "bullet");
  assert.deepEqual(doc.blocks[0]!.runs, [{ text: "Con " }, { text: "negrita", bold: true }, { text: " dentro" }]);
});

test("round-trip completo: bullets + negrita + cursiva mezclados", () => {
  const text = "Intro con *negrita*\n· Primer punto con **cursiva**\n· Segundo punto\nCierre normal";
  const doc = plainTextToRichText(text);
  assert.equal(richTextToPlainText(doc), text);
});

test("una línea vacía sigue dando un bloque sin runs (no '{text:\"\"}')", () => {
  const doc = plainTextToRichText("Primera\n\nTercera");
  assert.deepEqual(doc.blocks[1]!.runs, []);
});
