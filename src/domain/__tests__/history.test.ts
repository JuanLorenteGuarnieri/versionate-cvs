import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDatabase } from "../database.js";
import { appendHistory, clearHistory } from "../history.js";

test("appendHistory añade una entrada con id y timestamp, sin mutar la db original", () => {
  const db = createEmptyDatabase();
  const next = appendHistory(db, {
    type: "element_created",
    entityType: "element",
    entityId: "el-1",
    summary: "Se creó el elemento X",
  });

  assert.equal(db.history.length, 0, "la db original no se muta");
  assert.equal(next.history.length, 1);
  assert.equal(next.history[0]!.summary, "Se creó el elemento X");
  assert.ok(next.history[0]!.id);
  assert.ok(next.history[0]!.timestamp);
});

test("clearHistory vacía el historial sin tocar el resto de la db", () => {
  let db = createEmptyDatabase();
  db = appendHistory(db, { type: "element_created", entityType: "element", entityId: "el-1", summary: "Uno" });
  db = appendHistory(db, { type: "element_created", entityType: "element", entityId: "el-2", summary: "Dos" });
  assert.equal(db.history.length, 2);

  const cleared = clearHistory(db);
  assert.equal(cleared.history.length, 0);
  assert.equal(db.history.length, 2, "la db original no se muta");
  // El resto de la db se conserva intacta (misma referencia, ya que no se tocó).
  assert.equal(cleared.sections, db.sections);
  assert.equal(cleared.cvProjects, db.cvProjects);
});
