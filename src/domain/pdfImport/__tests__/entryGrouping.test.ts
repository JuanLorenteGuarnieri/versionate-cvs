import test from "node:test";
import assert from "node:assert/strict";
import { groupIntoLines, groupLinesIntoEntries } from "../entryGrouping.js";
import type { ExtractedTextItem } from "../types.js";

function item(text: string, x: number, y: number): ExtractedTextItem {
  return { text, x, y, fontSize: 10, fontName: "f1", page: 1 };
}

test("groupIntoLines agrupa items con la misma y en una sola línea", () => {
  const items = [item("Role", 50, 700), item("at Acme", 100, 700), item("Description", 50, 685)];
  const lines = groupIntoLines(items);
  assert.equal(lines.length, 2);
  assert.equal(lines[0]!.text, "Role at Acme");
  assert.equal(lines[1]!.text, "Description");
});

test("groupIntoLines respeta la tolerancia dada", () => {
  const items = [item("A", 50, 700), item("B", 50, 701.5)];
  assert.equal(groupIntoLines(items, 2).length, 1);
  assert.equal(groupIntoLines(items, 1).length, 2);
});

test("groupIntoLines con una lista vacía no revienta", () => {
  assert.deepEqual(groupIntoLines([]), []);
});

test("groupLinesIntoEntries separa entradas cuando el hueco vertical es mucho mayor de lo habitual", () => {
  // Líneas normales separadas 15pt; salto grande de 40pt antes de la 2ª entrada.
  // Texto largo a propósito (>40 caracteres) para no disparar el heurístico
  // de "lista simple de un ítem por línea" (ver test de ese caso más abajo).
  const lines = groupIntoLines([
    item("Senior Software Engineer, Backend Team Lead", 50, 700),
    item("Some Company That Has A Reasonably Long Name Inc.", 50, 685),
    item("Junior Software Engineer, Frontend Team Member", 50, 645), // hueco de 40 en vez de 15
    item("Another Company With A Reasonably Long Name LLC.", 50, 630),
  ]);
  const groups = groupLinesIntoEntries(lines);
  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups[0]!.lines.map((l) => l.text),
    ["Senior Software Engineer, Backend Team Lead", "Some Company That Has A Reasonably Long Name Inc."]
  );
  assert.deepEqual(
    groups[1]!.lines.map((l) => l.text),
    ["Junior Software Engineer, Frontend Team Member", "Another Company With A Reasonably Long Name LLC."]
  );
});

test("groupLinesIntoEntries no separa nada si todos los huecos son uniformes (párrafo envuelto)", () => {
  // Texto largo (como líneas envueltas de un párrafo), huecos uniformes:
  // debe quedarse en una sola entrada. Con líneas CORTAS y huecos uniformes
  // el resultado es justo el contrario — ver el siguiente test, es
  // precisamente el bug real que corrige el heurístico de "lista simple".
  const lines = groupIntoLines([
    item("This is the first line of a long wrapped paragraph", 50, 700),
    item("continuing here with more descriptive text about it", 50, 685),
    item("and it keeps going for a third full line of prose", 50, 670),
    item("finishing up the paragraph on this fourth line here", 50, 655),
  ]);
  const groups = groupLinesIntoEntries(lines);
  assert.equal(groups.length, 1);
});

test("regresión: una lista de un ítem corto por línea (sin huecos ni fechas) se separa en una entrada por línea", () => {
  // Bug real: Python / MATLAB / C++ cada uno en su propia línea, con el
  // mismo interlineado normal entre ellos (sin ningún hueco extra) — antes
  // se quedaban los tres pegados en una sola entrada, perdiendo dos de los
  // tres al mapear los campos (mapDraftEntryToFields solo coge la primera
  // línea como título).
  const lines = groupIntoLines([item("Python", 50, 700), item("MATLAB", 50, 685), item("C++", 50, 670)]);
  const groups = groupLinesIntoEntries(lines);
  assert.equal(groups.length, 3);
  assert.deepEqual(
    groups.map((g) => g.lines.map((l) => l.text)),
    [["Python"], ["MATLAB"], ["C++"]]
  );
});

test("una línea 'Etiqueta: valor' nunca abre una entrada nueva, ni siquiera con un hueco grande delante", () => {
  const lines = groupIntoLines([
    item("Japanese", 50, 700),
    item("Level : N5", 50, 660), // hueco grande, pero es una continuación de la línea anterior
  ]);
  const groups = groupLinesIntoEntries(lines);
  assert.equal(groups.length, 1);
  assert.deepEqual(
    groups[0]!.lines.map((l) => l.text),
    ["Japanese", "Level : N5"]
  );
});

test("una lista de líneas cortas CON fecha no se trata como lista simple (es una entrada normal tipo Experience)", () => {
  const lines = groupIntoLines([item("Intern", 50, 700), item("2020 - 2021", 50, 685)]);
  const groups = groupLinesIntoEntries(lines);
  assert.equal(groups.length, 1);
});

test("groupLinesIntoEntries con una sola línea da una sola entrada", () => {
  const lines = groupIntoLines([item("Solo", 50, 700)]);
  assert.equal(groupLinesIntoEntries(lines).length, 1);
});

test("groupLinesIntoEntries con una lista vacía devuelve una lista vacía", () => {
  assert.deepEqual(groupLinesIntoEntries([]), []);
});
