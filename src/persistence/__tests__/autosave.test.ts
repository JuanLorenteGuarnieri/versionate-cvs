import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDatabase } from "../../domain/database.js";
import { createMemoryStore } from "../memoryStore.js";
import { createAutosaveController } from "../autosave.js";
import type { Store } from "../store.js";

test("scheduleSave no escribe en el store hasta que pasa el delay", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const store = createMemoryStore();
  const autosave = createAutosaveController(store, 500);
  const db = createEmptyDatabase();

  autosave.scheduleSave(db);
  assert.equal(await store.load(), null, "todavía no debería haberse guardado");

  t.mock.timers.tick(500);
  // El guardado real es asíncrono (store.save es async); dejamos que el
  // microtask queue drene antes de comprobar.
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(await store.load(), db);
});

test("llamadas repetidas antes del delay solo producen un guardado, con el último estado", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const store = createMemoryStore();
  const autosave = createAutosaveController(store, 500);
  const dbV1 = createEmptyDatabase();
  const dbV2 = { ...dbV1, settings: { theme: "light" as const } };

  autosave.scheduleSave(dbV1);
  t.mock.timers.tick(300);
  autosave.scheduleSave(dbV2);
  t.mock.timers.tick(500);
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(await store.load(), dbV2);
});

test("flushNow() guarda inmediatamente si había un guardado pendiente", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const store = createMemoryStore();
  const autosave = createAutosaveController(store, 5000);
  const db = createEmptyDatabase();

  autosave.scheduleSave(db);
  assert.equal(autosave.hasPendingSave(), true);
  await autosave.flushNow();

  assert.equal(autosave.hasPendingSave(), false);
  assert.deepEqual(await store.load(), db);
});

test("flushNow() no hace nada si no había cambios pendientes", async () => {
  const store = createMemoryStore();
  const autosave = createAutosaveController(store, 500);
  await autosave.flushNow();
  assert.equal(await store.load(), null);
});

test("flushNow() propaga el error si el guardado explícito falla", async () => {
  const failingStore: Store = {
    async load() {
      return null;
    },
    async save() {
      throw new Error("disco lleno");
    },
    async clear() {},
  };
  const autosave = createAutosaveController(failingStore, 500);
  autosave.scheduleSave(createEmptyDatabase());
  await assert.rejects(() => autosave.flushNow(), /disco lleno/);
});

test("un fallo en el guardado en segundo plano NO lanza una excepción no controlada", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const originalConsoleError = console.error;
  const loggedErrors: unknown[] = [];
  console.error = (...args: unknown[]) => {
    loggedErrors.push(args);
  };
  try {
    const failingStore: Store = {
      async load() {
        return null;
      },
      async save() {
        throw new Error("disco lleno");
      },
      async clear() {},
    };
    const autosave = createAutosaveController(failingStore, 500);
    autosave.scheduleSave(createEmptyDatabase());
    t.mock.timers.tick(500);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(loggedErrors.length, 1, "el error se registra, no se oculta silenciosamente");
  } finally {
    console.error = originalConsoleError;
  }
});
