import test from "node:test";
import assert from "node:assert/strict";
import { moveItem } from "../arrayReorder.js";

test("mueve un elemento hacia adelante", () => {
  assert.deepEqual(moveItem(["a", "b", "c", "d"], 0, 2), ["b", "c", "a", "d"]);
});

test("mueve un elemento hacia atrás", () => {
  assert.deepEqual(moveItem(["a", "b", "c", "d"], 3, 1), ["a", "d", "b", "c"]);
});

test("fromIndex === toIndex no cambia nada (pero devuelve una copia nueva)", () => {
  const original = ["a", "b", "c"];
  const result = moveItem(original, 1, 1);
  assert.deepEqual(result, original);
  assert.notEqual(result, original, "debe ser una copia, no el mismo array");
});

test("no muta el array original", () => {
  const original = ["a", "b", "c"];
  moveItem(original, 0, 2);
  assert.deepEqual(original, ["a", "b", "c"]);
});

test("toIndex fuera de rango se recorta al último índice válido", () => {
  assert.deepEqual(moveItem(["a", "b", "c"], 0, 99), ["b", "c", "a"]);
});

test("toIndex negativo se recorta a 0", () => {
  assert.deepEqual(moveItem(["a", "b", "c"], 2, -5), ["c", "a", "b"]);
});

test("fromIndex fuera de rango devuelve una copia sin cambios", () => {
  assert.deepEqual(moveItem(["a", "b", "c"], 10, 0), ["a", "b", "c"]);
});

test("funciona con una lista de un solo elemento", () => {
  assert.deepEqual(moveItem(["a"], 0, 0), ["a"]);
});

test("funciona con objetos, no solo primitivos", () => {
  const a = { id: "a" };
  const b = { id: "b" };
  const result = moveItem([a, b], 0, 1);
  assert.deepEqual(result, [b, a]);
  assert.equal(result[0], b, "debe conservar las mismas referencias de objeto, no clonarlas");
});
