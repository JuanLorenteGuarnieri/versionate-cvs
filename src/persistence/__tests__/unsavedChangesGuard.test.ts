import test from "node:test";
import assert from "node:assert/strict";
import {
  attachUnsavedChangesGuard,
  createDirtyTracker,
  type BeforeUnloadLikeEvent,
  type BeforeUnloadTarget,
} from "../unsavedChangesGuard.js";

function createFakeTarget(): BeforeUnloadTarget & { fire(): BeforeUnloadLikeEvent } {
  let handler: ((e: BeforeUnloadLikeEvent) => void) | null = null;
  return {
    addEventListener(_type, listener) {
      handler = listener;
    },
    removeEventListener(_type, listener) {
      if (handler === listener) handler = null;
    },
    fire() {
      const event: BeforeUnloadLikeEvent = {
        preventDefault: () => {
          (event as any)._prevented = true;
        },
        returnValue: "",
      };
      handler?.(event);
      return event;
    },
  };
}

test("createDirtyTracker empieza limpio y refleja markDirty/markClean", () => {
  const tracker = createDirtyTracker();
  assert.equal(tracker.isDirty(), false);
  tracker.markDirty();
  assert.equal(tracker.isDirty(), true);
  tracker.markClean();
  assert.equal(tracker.isDirty(), false);
});

test("con cambios sin guardar, el evento beforeunload se cancela (preventDefault + returnValue)", () => {
  const tracker = createDirtyTracker();
  const target = createFakeTarget();
  attachUnsavedChangesGuard(target, tracker);

  tracker.markDirty();
  const event = target.fire();
  assert.equal((event as any)._prevented, true);
  assert.equal(event.returnValue, "", "el texto del aviso lo controla el navegador, no la app (§12)");
});

test("sin cambios pendientes, el evento no se toca", () => {
  const tracker = createDirtyTracker();
  const target = createFakeTarget();
  attachUnsavedChangesGuard(target, tracker);

  const event = target.fire();
  assert.equal((event as any)._prevented, undefined);
});

test("la función de desenganche quita el listener", () => {
  const tracker = createDirtyTracker();
  const target = createFakeTarget();
  const detach = attachUnsavedChangesGuard(target, tracker);
  tracker.markDirty();

  detach();
  const event = target.fire();
  assert.equal((event as any)._prevented, undefined, "tras desenganchar, ya no debería activarse");
});
