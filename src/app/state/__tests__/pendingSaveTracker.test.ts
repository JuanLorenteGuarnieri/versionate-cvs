import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDatabase } from "../../../domain/database.js";
import { createMemoryStore } from "../../../persistence/memoryStore.js";
import { createAutosaveController } from "../../../persistence/autosave.js";
import { createPendingSaveTracker } from "../pendingSaveTracker.js";

test("isDirty() refleja hasPendingSave() del autosave, sin estado propio", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const autosave = createAutosaveController(createMemoryStore(), 500);
  const tracker = createPendingSaveTracker(autosave);

  assert.equal(tracker.isDirty(), false);
  autosave.scheduleSave(createEmptyDatabase());
  assert.equal(tracker.isDirty(), true);

  t.mock.timers.tick(500);
  assert.equal(tracker.isDirty(), false, "tras dispararse el guardado, ya no hay nada pendiente");
});

test("markDirty()/markClean() son no-ops: no pueden desincronizar el estado real", () => {
  const autosave = createAutosaveController(createMemoryStore(), 500);
  const tracker = createPendingSaveTracker(autosave);
  tracker.markDirty();
  assert.equal(tracker.isDirty(), false, "markDirty no debe inventarse un pendiente que no existe");
});
