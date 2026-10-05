import test from "node:test";
import assert from "node:assert/strict";
import { findProofreadingIssues } from "../proofreading.js";

test("detecta dobles espacios", () => {
  const issues = findProofreadingIssues("Ingeniero  de software con experiencia.");
  assert.ok(issues.some((i) => i.type === "double_space"));
});

test("detecta palabras repetidas consecutivas", () => {
  const issues = findProofreadingIssues("Trabajé en el el equipo de backend.");
  const issue = issues.find((i) => i.type === "repeated_word");
  assert.ok(issue);
  assert.ok(issue!.message.includes("el"));
});

test("detecta falta de espacio después de puntuación", () => {
  const issues = findProofreadingIssues("Responsable de backend,frontend y DevOps.");
  assert.ok(issues.some((i) => i.type === "missing_space_after_punctuation"));
});

test("detecta puntuación excesiva/informal", () => {
  const issues = findProofreadingIssues("¡Conseguí el objetivo!!! Fue un éxito rotundo....");
  assert.ok(issues.some((i) => i.type === "excessive_punctuation"));
});

test("detecta espacio antes de un signo de puntuación", () => {
  const issues = findProofreadingIssues("Desarrollador senior , con experiencia en Python.");
  assert.ok(issues.some((i) => i.type === "space_before_punctuation"));
});

test("un texto limpio no genera ningún aviso", () => {
  const issues = findProofreadingIssues("Ingeniero de software con cinco años de experiencia en Python y React.");
  assert.deepEqual(issues, []);
});

test("cada tipo de aviso se limita a un máximo razonable de apariciones", () => {
  const text = Array.from({ length: 20 }, () => "muy  bien").join(". ");
  const issues = findProofreadingIssues(text);
  const doubleSpaceIssues = issues.filter((i) => i.type === "double_space");
  assert.ok(doubleSpaceIssues.length <= 8);
});

test("cada aviso incluye un fragmento de contexto para poder localizarlo", () => {
  const issues = findProofreadingIssues("Ingeniero  de software.");
  assert.ok(issues[0]!.snippet.length > 0);
});
