import test from "node:test";
import assert from "node:assert/strict";
import { mmToPx, paginate, type PaginationBlock } from "../pagination.js";

function block(id: string, kind: "section-title" | "item", sectionId: string, height: number): PaginationBlock {
  return { id, kind, sectionId, height };
}

test("mmToPx convierte con la constante fija de CSS (96px = 25.4mm)", () => {
  assert.ok(Math.abs(mmToPx(25.4) - 96) < 0.001);
  assert.equal(mmToPx(0), 0);
});

test("una lista vacía no produce ninguna página", () => {
  assert.deepEqual(paginate([], 1000), []);
});

test("todo lo que cabe en una página se queda en una sola página", () => {
  const blocks = [block("t1", "section-title", "s1", 50), block("i1", "item", "s1", 100)];
  const pages = paginate(blocks, 1000);
  assert.equal(pages.length, 1);
  assert.deepEqual(pages[0], blocks);
});

test("el contenido que desborda pasa a una segunda página, sin partir ningún bloque", () => {
  const blocks = [
    block("t1", "section-title", "s1", 50),
    block("i1", "item", "s1", 400),
    block("i2", "item", "s1", 400),
    block("i3", "item", "s1", 400),
  ];
  const pages = paginate(blocks, 500);
  // Página 1: título (50) + i1 (400) = 450, cabe. i2 no cabe (450+400>500).
  assert.deepEqual(pages[0]!.map((b) => b.id), ["t1", "i1"]);
  assert.deepEqual(pages[1]!.map((b) => b.id), ["i2"]);
  assert.deepEqual(pages[2]!.map((b) => b.id), ["i3"]);
});

test("todos los bloques aparecen exactamente una vez, en el orden original", () => {
  const blocks = Array.from({ length: 12 }, (_, i) => block(`b${i}`, "item", "s1", 90));
  const pages = paginate(blocks, 300);
  const flat = pages.flat();
  assert.deepEqual(flat.map((b) => b.id), blocks.map((b) => b.id));
});

test("un título huérfano se empuja entero a la siguiente página junto a su primer item", () => {
  // Queda espacio para el título solo (50 de 100 restantes), pero no para
  // título + primer item (50 + 80 > 100).
  const blocks = [
    block("filler", "item", "s0", 400),
    block("t1", "section-title", "s1", 50),
    block("i1", "item", "s1", 80),
  ];
  const pages = paginate(blocks, 500);
  assert.deepEqual(pages[0]!.map((b) => b.id), ["filler"]);
  assert.deepEqual(pages[1]!.map((b) => b.id), ["t1", "i1"]);
});

test("si título + primer item SÍ caben juntos, no se produce salto innecesario", () => {
  const blocks = [
    block("filler", "item", "s0", 400),
    block("t1", "section-title", "s1", 30),
    block("i1", "item", "s1", 60),
  ];
  const pages = paginate(blocks, 500);
  assert.equal(pages.length, 1);
});

test("un título al principio de una página vacía nunca se empuja (evita bucle infinito)", () => {
  const blocks = [block("t1", "section-title", "s1", 900), block("i1", "item", "s1", 900)];
  const pages = paginate(blocks, 500);
  assert.deepEqual(pages[0]!.map((b) => b.id), ["t1"]);
  assert.deepEqual(pages[1]!.map((b) => b.id), ["i1"]);
});

test("un item individual más alto que una página entera ocupa su propia página sin bucle infinito", () => {
  const blocks = [block("normal", "item", "s1", 100), block("gigante", "item", "s1", 5000)];
  const pages = paginate(blocks, 500);
  assert.deepEqual(pages[0]!.map((b) => b.id), ["normal"]);
  assert.deepEqual(pages[1]!.map((b) => b.id), ["gigante"]);
});

test("un título seguido de un item de OTRA sección no aplica la regla anti-huérfanos entre ellos", () => {
  // Esto no debería ocurrir en la práctica (resolveCV siempre pone al menos
  // un item de la misma sección tras su título), pero el algoritmo no debe
  // reventar ni comportarse raro si pasara.
  const blocks = [block("t1", "section-title", "s1", 50), block("i1", "item", "s2", 500)];
  const pages = paginate(blocks, 100);
  assert.deepEqual(pages[0]!.map((b) => b.id), ["t1"]);
  assert.deepEqual(pages[1]!.map((b) => b.id), ["i1"]);
});
