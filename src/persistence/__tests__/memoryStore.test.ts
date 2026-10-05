import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDatabase } from "../../domain/database.js";
import { createMemoryStore } from "../memoryStore.js";

test("load() devuelve null si nunca se ha guardado nada", async () => {
  const store = createMemoryStore();
  assert.equal(await store.load(), null);
});

test("save() seguido de load() devuelve exactamente lo guardado", async () => {
  const store = createMemoryStore();
  const db = createEmptyDatabase();
  await store.save(db);
  const loaded = await store.load();
  assert.deepEqual(loaded, db);
});

test("clear() borra el registro guardado", async () => {
  const store = createMemoryStore(createEmptyDatabase());
  await store.clear();
  assert.equal(await store.load(), null);
});
