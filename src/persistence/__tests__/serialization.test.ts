import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDatabase } from "../../domain/database.js";
import { createElement } from "../../domain/variants.js";
import {
  DatabaseValidationError,
  parseDatabase,
  serializeDatabase,
  suggestBackupFilename,
} from "../serialization.js";

test("round-trip: serializar e importar de vuelta da la misma base de datos", () => {
  const projectsSection = createEmptyDatabase().sections.find((s) => s.key === "projects")!;
  const { db } = createElement(createEmptyDatabase(), {
    sectionId: projectsSection.id,
    variantName: "Original",
    fields: { title: "Scanpath Prediction" },
  });

  const json = serializeDatabase(db);
  const parsed = parseDatabase(json);
  assert.deepEqual(parsed, db);
});

test("el JSON exportado es legible (indentado), no minificado (§14 del contexto)", () => {
  const json = serializeDatabase(createEmptyDatabase());
  assert.ok(json.includes("\n  "), "debe tener saltos de línea e indentación de 2 espacios");
});

test("parseDatabase lanza DatabaseValidationError con JSON corrupto, no un SyntaxError crudo", () => {
  assert.throws(() => parseDatabase("{ esto no es json"), DatabaseValidationError);
});

test("parseDatabase valida la forma incluso si el JSON es sintácticamente correcto", () => {
  assert.throws(() => parseDatabase(JSON.stringify({ foo: "bar" })), DatabaseValidationError);
});

test("suggestBackupFilename produce un nombre único y con extensión .json", () => {
  const a = suggestBackupFilename(new Date("2026-08-26T10:15:00.000Z"));
  assert.equal(a, "versionate-cvs-backup-2026-08-26T10-15-00-000Z.json");
});
