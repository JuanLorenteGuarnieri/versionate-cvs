import test from "node:test";
import assert from "node:assert/strict";
import { detectJobDescriptionLanguage } from "../languageDetection.js";

test("detecta español en una oferta típica en español", () => {
  const text = "Buscamos un desarrollador con experiencia en Python para nuestro equipo. Se valorará conocimiento de Django y buenas habilidades de comunicación.";
  assert.equal(detectJobDescriptionLanguage(text), "es");
});

test("detecta inglés en una oferta típica en inglés", () => {
  const text = "We are looking for a developer with experience in Python for our team. Knowledge of Django and good communication skills will be valued.";
  assert.equal(detectJobDescriptionLanguage(text), "en");
});

test("devuelve null si no hay suficiente señal (texto muy corto)", () => {
  assert.equal(detectJobDescriptionLanguage("Python"), null);
  assert.equal(detectJobDescriptionLanguage(""), null);
});

test("en empate razonable, se decanta por español (convención del proyecto)", () => {
  // mismas palabras marcador de cada idioma, en igual cantidad
  const text = "the the the de de de";
  assert.equal(detectJobDescriptionLanguage(text), "es");
});
