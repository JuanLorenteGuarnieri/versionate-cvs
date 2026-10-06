import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDatabase } from "../database.js";
import { createElement, forkVariant } from "../variants.js";
import {
  buildJobKeywordScores,
  computeCategorizedKeywordComparison,
  computeItemCategoryImpacts,
  computeMatchScoreForSelection,
  computeScoreBreakdown,
  defaultSelectionFromMatch,
  extractStoredJobDescription,
  filterVariantsByLanguageTag,
  guessCompanyName,
  guessJobTitle,
  JOB_DESCRIPTION_NOTES_PREFIX,
  matchDatabaseToJobDescription,
  scoreAllVariantsForElement,
  selectByMarginalCoverage,
  selectionFromCvVersion,
  stem,
  suggestImprovements,
  type ElementJobMatch,
} from "../jobMatching.js";
import { plainTextToRichText } from "../richtext.js";
import { createCVProject, setSectionItems } from "../cv.js";
import { createTemplate } from "../templates.js";

function sectionId(db: ReturnType<typeof createEmptyDatabase>, key: string): string {
  return db.sections.find((s) => s.key === key)!.id;
}

// ---------- guessJobTitle ----------

test("guessJobTitle usa la primera línea no vacía del texto pegado", () => {
  assert.equal(guessJobTitle("Senior Backend Engineer\n\nAcerca de la empresa..."), "Senior Backend Engineer");
});

test("guessJobTitle ignora líneas en blanco iniciales", () => {
  assert.equal(guessJobTitle("\n\n  \nData Scientist\nMás texto"), "Data Scientist");
});

test("guessJobTitle recorta líneas absurdamente largas", () => {
  const long = "A".repeat(200);
  const title = guessJobTitle(long);
  assert.ok(title.length <= 82);
  assert.ok(title.endsWith("…"));
});

test("guessJobTitle da un nombre por defecto si no hay texto", () => {
  assert.equal(guessJobTitle(""), "CV para nueva oferta");
  assert.equal(guessJobTitle("   \n   "), "CV para nueva oferta");
});

// ---------- stem ----------

test("stem agrupa plurales simples con su singular", () => {
  assert.equal(stem("requirements"), stem("requirement"));
  assert.equal(stem("projects"), stem("project"));
  assert.equal(stem("proyectos"), stem("proyecto"));
});

test("stem no toca palabras cortas (protege siglas como 'aws', 'css', 'sql')", () => {
  assert.equal(stem("aws"), "aws");
  assert.equal(stem("css"), "css");
  assert.equal(stem("sql"), "sql");
});

test("stem no recorta palabras que acaban en 'ss'/'us'/'is' aunque sean largas", () => {
  assert.equal(stem("business"), "business");
  assert.equal(stem("status"), "status");
  assert.equal(stem("analysis"), "analysis");
});

// ---------- buildJobKeywordScores ----------

test("buildJobKeywordScores agrupa singular y plural bajo la misma keyword, sumando su frecuencia", () => {
  const keywords = buildJobKeywordScores("project projects projects requirement requirements");
  const projectKw = keywords.find((k) => stem(k.display) === stem("project"));
  assert.ok(projectKw);
  assert.equal(projectKw!.totalCount, 3);
});

test("buildJobKeywordScores limita el número de keywords distintas devueltas", () => {
  const words = Array.from({ length: 100 }, (_, i) => `keyword${i}`).join(" ");
  const keywords = buildJobKeywordScores(words, 10);
  assert.equal(keywords.length, 10);
});

test("buildJobKeywordScores usa la forma superficial MÁS FRECUENTE como texto a mostrar", () => {
  const keywords = buildJobKeywordScores("skill skills skills skills");
  const kw = keywords.find((k) => stem(k.display) === stem("skill"));
  assert.equal(kw!.display, "skills");
});

// ---------- selectByMarginalCoverage ----------

function fakeMatch(elementId: string, score: number, keywordStems: string[]): ElementJobMatch {
  return {
    elementId,
    bestVariantId: `${elementId}-v1`,
    score,
    matchedKeywords: keywordStems.map((s) => ({ stem: s, display: s, totalCount: 1, weight: 1, isTech: false })),
    availableVariants: [],
  };
}

test("selectByMarginalCoverage prioriza cobertura de keywords nuevas sobre puntuación bruta", () => {
  // A y B puntúan igual de alto (puntuación 3) pero cubren EXACTAMENTE las
  // mismas 3 keywords; C puntúa menos (2) pero cubre 2 keywords que A/B no
  // tienen. Con un máximo de 2 elementos, lo óptimo es A (o B) + C, no A+B.
  const a = fakeMatch("a", 3, ["react", "typescript", "docker"]);
  const b = fakeMatch("b", 3, ["react", "typescript", "docker"]);
  const c = fakeMatch("c", 2, ["python", "aws"]);
  const selected = selectByMarginalCoverage([a, b, c], 2);
  const ids = selected.map((s) => s.elementId).sort();
  assert.deepEqual(ids, ["a", "c"].sort());
});

test("selectByMarginalCoverage rellena con la mejor puntuación bruta cuando ya no hay más cobertura que ganar", () => {
  const a = fakeMatch("a", 5, ["react"]);
  const b = fakeMatch("b", 3, ["react"]); // misma keyword, ya cubierta tras 'a'
  const c = fakeMatch("c", 1, ["react"]);
  const selected = selectByMarginalCoverage([a, b, c], 2);
  assert.deepEqual(
    selected.map((s) => s.elementId),
    ["a", "b"]
  );
});

test("selectByMarginalCoverage nunca devuelve más de maxItems", () => {
  const candidates = Array.from({ length: 10 }, (_, i) => fakeMatch(`e${i}`, 1, [`k${i}`]));
  assert.equal(selectByMarginalCoverage(candidates, 3).length, 3);
});

// ---------- matchDatabaseToJobDescription ----------

test("personal-information/profile/skills se incluyen siempre enteros, sin puntuar", () => {
  let db = createEmptyDatabase();
  db = createElement(db, { sectionId: sectionId(db, "personal-information"), variantName: "Original", fields: { fullName: "Jane Doe" } }).db;
  db = createElement(db, {
    sectionId: sectionId(db, "profile"),
    variantName: "Original",
    fields: { summary: plainTextToRichText("Nada que ver con la oferta en absoluto.") },
  }).db;

  const result = matchDatabaseToJobDescription(db, "Senior React Developer with Node.js experience");
  const personalSection = result.sections.find((s) => s.sectionDefinitionId === sectionId(db, "personal-information"));
  const profileSection = result.sections.find((s) => s.sectionDefinitionId === sectionId(db, "profile"));
  assert.equal(personalSection?.items.length, 1);
  assert.ok(personalSection?.items[0]!.defaultIncluded);
  assert.equal(profileSection?.items.length, 1);
});

test("selecciona el proyecto que más keywords comparte con la oferta como propuesta por defecto", () => {
  let db = createEmptyDatabase();
  const projectsId = sectionId(db, "projects");
  const reactProject = createElement(db, {
    sectionId: projectsId,
    variantName: "Original",
    fields: { title: "React Dashboard", description: plainTextToRichText("Built a dashboard using React and TypeScript.") },
  });
  db = reactProject.db;
  const unrelatedProject = createElement(db, {
    sectionId: projectsId,
    variantName: "Original",
    fields: { title: "Garden Planner", description: plainTextToRichText("A hobby app for planning a vegetable garden.") },
  });
  db = unrelatedProject.db;

  const result = matchDatabaseToJobDescription(db, "We need a React and TypeScript developer for our dashboard team");
  const projectsSection = result.sections.find((s) => s.sectionDefinitionId === projectsId)!;
  const defaultItems = projectsSection.items.filter((i) => i.defaultIncluded);
  assert.equal(defaultItems.length, 1);
  assert.equal(defaultItems[0]!.elementId, reactProject.element.id);
});

test("una sección sin ningún elemento relacionado con la oferta SIGUE apareciendo, pero con todo en defaultIncluded=false", () => {
  let db = createEmptyDatabase();
  const projectsId = sectionId(db, "projects");
  const unrelated = createElement(db, {
    sectionId: projectsId,
    variantName: "Original",
    fields: { title: "Garden Planner", description: plainTextToRichText("A hobby app for planning a vegetable garden.") },
  });
  db = unrelated.db;

  const result = matchDatabaseToJobDescription(db, "Looking for a Senior React and Node.js Engineer");
  const projectsSection = result.sections.find((s) => s.sectionDefinitionId === projectsId);
  assert.ok(projectsSection, "la sección debe seguir apareciendo para poder añadirla a mano");
  assert.equal(projectsSection!.items.length, 1);
  assert.equal(projectsSection!.items[0]!.defaultIncluded, false);
});

test("elige, de entre las VARIANTES existentes de un elemento, la que mejor encaja — sin crear ninguna nueva", () => {
  let db = createEmptyDatabase();
  const projectsId = sectionId(db, "projects");
  const created = createElement(db, {
    sectionId: projectsId,
    variantName: "Backend focus",
    fields: { title: "Inventory System", description: plainTextToRichText("A backend service in Python and PostgreSQL.") },
  });
  db = created.db;
  const forked = forkVariant(db, created.variant.id, "Frontend focus", {
    title: "Inventory System",
    description: plainTextToRichText("A React frontend with TypeScript for managing inventory."),
  });
  db = forked.db;

  const variantCountBefore = db.variants.length;
  const result = matchDatabaseToJobDescription(db, "Looking for a React and TypeScript frontend developer");
  assert.equal(db.variants.length, variantCountBefore);
  const projectsSection = result.sections.find((s) => s.sectionDefinitionId === projectsId);
  const defaultItem = projectsSection!.items.find((i) => i.defaultIncluded);
  assert.equal(defaultItem?.variantId, forked.variant.id);
});

test("limita el número de elementos por defecto por sección de contenido a un máximo configurable", () => {
  let db = createEmptyDatabase();
  const projectsId = sectionId(db, "projects");
  for (let i = 0; i < 10; i++) {
    db = createElement(db, {
      sectionId: projectsId,
      variantName: "Original",
      fields: { title: `React Project ${i}`, description: plainTextToRichText("Built with React and TypeScript.") },
    }).db;
  }
  const result = matchDatabaseToJobDescription(db, "React and TypeScript developer needed");
  const projectsSection = result.sections.find((s) => s.sectionDefinitionId === projectsId)!;
  assert.equal(projectsSection.items.filter((i) => i.defaultIncluded).length, 6);
  assert.equal(projectsSection.items.length, 10); // el resto sigue disponible como "otras opciones"

  const custom = matchDatabaseToJobDescription(db, "React and TypeScript developer needed", { maxItemsPerSection: 2 });
  const customSection = custom.sections.find((s) => s.sectionDefinitionId === projectsId)!;
  assert.equal(customSection.items.filter((i) => i.defaultIncluded).length, 2);
});

test("minScoreToInclude configurable cambia qué cuenta como suficiente relación", () => {
  let db = createEmptyDatabase();
  const projectsId = sectionId(db, "projects");
  db = createElement(db, {
    sectionId: projectsId,
    variantName: "Original",
    fields: { title: "Something", description: plainTextToRichText("Mentions react exactly once.") },
  }).db;

  const permissive = matchDatabaseToJobDescription(db, "react", { minScoreToInclude: 1 });
  const strict = matchDatabaseToJobDescription(db, "react", { minScoreToInclude: 999 });
  const permissiveSection = permissive.sections.find((s) => s.sectionDefinitionId === projectsId)!;
  const strictSection = strict.sections.find((s) => s.sectionDefinitionId === projectsId)!;
  assert.equal(permissiveSection.items.some((i) => i.defaultIncluded), true);
  assert.equal(strictSection.items.some((i) => i.defaultIncluded), false);
});

test("una base de datos vacía da un resultado vacío pero no revienta", () => {
  const db = createEmptyDatabase();
  const result = matchDatabaseToJobDescription(db, "React developer needed");
  assert.deepEqual(result.sections, []);
});

test("matchDatabaseToJobDescription incluye la etiqueta, la puntuación y las keywords coincidentes de cada item", () => {
  let db = createEmptyDatabase();
  const projectsId = sectionId(db, "projects");
  db = createElement(db, {
    sectionId: projectsId,
    variantName: "Original",
    fields: { title: "React Dashboard", description: plainTextToRichText("Built with React and TypeScript.") },
  }).db;

  const result = matchDatabaseToJobDescription(db, "React and TypeScript developer");
  const item = result.sections.find((s) => s.sectionDefinitionId === projectsId)!.items[0]!;
  assert.equal(item.label, "React Dashboard");
  assert.ok(item.score > 0);
  assert.ok(item.matchedKeywords.some((k) => k.toLowerCase() === "react"));
});

test("matchDatabaseToJobDescription marca alwaysIncluded=true en personal-information/profile/skills, false en el resto", () => {
  let db = createEmptyDatabase();
  db = createElement(db, { sectionId: sectionId(db, "personal-information"), variantName: "Original", fields: { fullName: "Jane" } }).db;
  db = createElement(db, {
    sectionId: sectionId(db, "projects"),
    variantName: "Original",
    fields: { title: "React Dashboard", description: plainTextToRichText("React and TypeScript.") },
  }).db;

  const result = matchDatabaseToJobDescription(db, "React developer");
  assert.equal(result.sections.find((s) => s.sectionDefinitionId === sectionId(db, "personal-information"))!.alwaysIncluded, true);
  assert.equal(result.sections.find((s) => s.sectionDefinitionId === sectionId(db, "projects"))!.alwaysIncluded, false);
});

test("matchDatabaseToJobDescription da una puntuación global coherente con la selección propuesta", () => {
  let db = createEmptyDatabase();
  db = createElement(db, {
    sectionId: sectionId(db, "projects"),
    variantName: "Original",
    fields: { title: "React Dashboard", description: plainTextToRichText("Built with React and TypeScript.") },
  }).db;

  const result = matchDatabaseToJobDescription(db, "React and TypeScript developer");
  assert.ok(result.matchScore > 0);
});

test("matchDatabaseToJobDescription expone las keywords más relevantes de la oferta", () => {
  const db = createEmptyDatabase();
  const result = matchDatabaseToJobDescription(db, "React React React TypeScript");
  assert.ok(result.jobKeywords.some((k) => k.term.toLowerCase() === "react" && k.count === 3));
});

// ---------- defaultSelectionFromMatch ----------

test("defaultSelectionFromMatch solo incluye los items marcados defaultIncluded", () => {
  let db = createEmptyDatabase();
  const projectsId = sectionId(db, "projects");
  db = createElement(db, { sectionId: projectsId, variantName: "Original", fields: { title: "Unrelated thing" } }).db;

  const result = matchDatabaseToJobDescription(db, "React developer");
  const selection = defaultSelectionFromMatch(result);
  const projectsSelection = selection.find((s) => s.sectionDefinitionId === projectsId);
  assert.equal(projectsSelection?.items.length, 0);
});

// ---------- computeMatchScoreForSelection ----------

test("computeMatchScoreForSelection sube al añadir un elemento que cubre más keywords, y baja al quitarlo", () => {
  let db = createEmptyDatabase();
  const projectsId = sectionId(db, "projects");
  const created = createElement(db, {
    sectionId: projectsId,
    variantName: "Original",
    fields: { title: "React Dashboard", description: plainTextToRichText("Built with React and TypeScript.") },
  });
  db = created.db;

  const jobText = "React and TypeScript developer";
  const withItem = computeMatchScoreForSelection(
    db,
    [{ sectionDefinitionId: projectsId, items: [{ elementId: created.element.id, variantId: created.variant.id }] }],
    jobText
  );
  const withoutItem = computeMatchScoreForSelection(db, [{ sectionDefinitionId: projectsId, items: [] }], jobText);

  assert.ok(withItem > withoutItem);
  assert.equal(withoutItem, 0);
});

test("computeMatchScoreForSelection reconoce singular/plural como la misma keyword", () => {
  let db = createEmptyDatabase();
  const projectsId = sectionId(db, "projects");
  const created = createElement(db, {
    sectionId: projectsId,
    variantName: "Original",
    fields: { title: "Requirement Tracker", description: plainTextToRichText("Tracks project requirement details.") },
  });
  db = created.db;

  const score = computeMatchScoreForSelection(
    db,
    [{ sectionDefinitionId: projectsId, items: [{ elementId: created.element.id, variantId: created.variant.id }] }],
    "Looking for someone who understands requirements gathering"
  );
  assert.ok(score > 0);
});

// ---------- extractStoredJobDescription ----------

test("extractStoredJobDescription recupera el texto de la oferta guardado en las notas", () => {
  const notes = `${JOB_DESCRIPTION_NOTES_PREFIX}Senior React Developer\n\nMore details...`;
  assert.equal(extractStoredJobDescription(notes), "Senior React Developer\n\nMore details...");
});

test("extractStoredJobDescription devuelve null si las notas no vienen de esta funcionalidad", () => {
  assert.equal(extractStoredJobDescription("Notas escritas a mano por el usuario."), null);
  assert.equal(extractStoredJobDescription(undefined), null);
  assert.equal(extractStoredJobDescription(""), null);
});

// ---------- suggestImprovements ----------

test("suggestImprovements propone añadir un elemento no incluido que cubre keywords que el CV no tiene", () => {
  let db = createEmptyDatabase();
  const projectsId = sectionId(db, "projects");
  const included = createElement(db, {
    sectionId: projectsId,
    variantName: "Original",
    fields: { title: "Garden Planner", description: plainTextToRichText("A hobby app for planning a garden.") },
  });
  db = included.db;
  const notIncluded = createElement(db, {
    sectionId: projectsId,
    variantName: "Original",
    fields: { title: "React Dashboard", description: plainTextToRichText("Built with React and TypeScript.") },
  });
  db = notIncluded.db;

  const templateResult = createTemplate(db, { name: "T" });
  db = templateResult.db;
  const { db: withProject, version } = createCVProject(db, { name: "Test CV", templateId: templateResult.template.id });
  db = withProject;
  db = setSectionItems(db, version.id, projectsId, [{ elementId: included.element.id, variantId: included.variant.id }]);

  const suggestions = suggestImprovements(db, version.id, "React and TypeScript developer");
  assert.ok(suggestions.length > 0);
  const suggestion = suggestions[0]!;
  assert.equal(suggestion.type, "add");
  assert.equal(suggestion.suggestedElementId, notIncluded.element.id);
  assert.ok(suggestion.newKeywords.some((k) => k.toLowerCase() === "react"));
});

test("suggestImprovements no sugiere nada si el candidato no aporta ninguna keyword que el CV no tenga ya", () => {
  let db = createEmptyDatabase();
  const projectsId = sectionId(db, "projects");
  const included = createElement(db, {
    sectionId: projectsId,
    variantName: "Original",
    fields: { title: "React Dashboard v1", description: plainTextToRichText("Built with React and TypeScript.") },
  });
  db = included.db;
  const notIncluded = createElement(db, {
    sectionId: projectsId,
    variantName: "Original",
    fields: { title: "React Dashboard v2", description: plainTextToRichText("Also React and TypeScript, nothing new.") },
  });
  db = notIncluded.db;

  const templateResult2 = createTemplate(db, { name: "T" });
  db = templateResult2.db;
  const { db: withProject, version } = createCVProject(db, { name: "Test CV", templateId: templateResult2.template.id });
  db = withProject;
  db = setSectionItems(db, version.id, projectsId, [{ elementId: included.element.id, variantId: included.variant.id }]);

  const suggestions = suggestImprovements(db, version.id, "React and TypeScript developer");
  assert.equal(suggestions.length, 0);
});

test("suggestImprovements devuelve vacío para una versión de CV inexistente", () => {
  const db = createEmptyDatabase();
  assert.deepEqual(suggestImprovements(db, "no-existe", "React developer"), []);
});

test("los idiomas se incluyen siempre por defecto, igual que personal-information/profile/skills", () => {
  let db = createEmptyDatabase();
  db = createElement(db, {
    sectionId: sectionId(db, "languages"),
    variantName: "Original",
    fields: { name: "English", level: "C1" },
  }).db;

  const result = matchDatabaseToJobDescription(db, "Backend developer with no language requirements mentioned");
  const languagesSection = result.sections.find((s) => s.sectionDefinitionId === sectionId(db, "languages"));
  assert.ok(languagesSection);
  assert.equal(languagesSection!.alwaysIncluded, true);
  assert.equal(languagesSection!.items[0]!.defaultIncluded, true);
});

// ---------- computeScoreBreakdown ----------

test("computeScoreBreakdown: la puntuación de educación sube cuando la Educación seleccionada menciona lo que pide la oferta", () => {
  let db = createEmptyDatabase();
  const educationId = sectionId(db, "education");
  const created = createElement(db, {
    sectionId: educationId,
    variantName: "Original",
    fields: { degree: "Ingeniería Informática", institution: "Universidad Ejemplo" },
  });
  db = created.db;

  const selection = [{ sectionDefinitionId: educationId, items: [{ elementId: created.element.id, variantId: created.variant.id }] }];
  const breakdown = computeScoreBreakdown(db, selection, "Se requiere titulación en Ingeniería Informática");
  assert.ok(breakdown.education.score > 0);
  assert.ok(breakdown.education.detail.toLowerCase().includes("ingenieria") || breakdown.education.detail.toLowerCase().includes("informatica"));
});

test("computeScoreBreakdown: educación da 0 con detalle explicativo si no se ha seleccionado nada de Educación", () => {
  const db = createEmptyDatabase();
  const breakdown = computeScoreBreakdown(db, [], "Se requiere titulación en Ingeniería");
  assert.equal(breakdown.education.score, 0);
  assert.ok(breakdown.education.detail.length > 0);
});

test("computeScoreBreakdown: technologies ahora cuenta CUALQUIER sección que mencione tecnologías reconocidas, no solo Skills (petición explícita: 'que pueda apoyar a los 3 a la vez')", () => {
  let db = createEmptyDatabase();
  const skillsId = sectionId(db, "skills");
  const projectsId = sectionId(db, "projects");
  const skillsEl = createElement(db, {
    sectionId: skillsId,
    variantName: "Original",
    fields: { programmingLanguages: ["Python"], technologies: ["Docker"] },
  });
  db = skillsEl.db;
  const projectEl = createElement(db, {
    sectionId: projectsId,
    variantName: "Original",
    fields: { title: "React Dashboard" }, // "react" SÍ debería contar ahora, es una tecnología reconocida
  });
  db = projectEl.db;

  const withProjectOnly = computeScoreBreakdown(
    db,
    [{ sectionDefinitionId: projectsId, items: [{ elementId: projectEl.element.id, variantId: projectEl.variant.id }] }],
    "We need Python, Docker and React skills"
  );
  assert.ok(withProjectOnly.technologies.detail.toLowerCase().includes("react"));
  assert.ok(withProjectOnly.technologies.score > 0);
});

test("computeScoreBreakdown: technologies NO cuenta palabras que no sean tecnologías reconocidas, aunque estén en Skills", () => {
  let db = createEmptyDatabase();
  const skillsId = sectionId(db, "skills");
  const skillsEl = createElement(db, {
    sectionId: skillsId,
    variantName: "Original",
    fields: { softSkills: ["Liderazgo", "Comunicación"] },
  });
  db = skillsEl.db;

  const breakdown = computeScoreBreakdown(
    db,
    [{ sectionDefinitionId: skillsId, items: [{ elementId: skillsEl.element.id, variantId: skillsEl.variant.id }] }],
    "Buscamos experiencia en Python y Docker"
  );
  // Ninguna keyword de "technologies" (python, docker) puede estar cubierta por "liderazgo"/"comunicación".
  assert.equal(breakdown.technologies.score, 0);
});

test("computeScoreBreakdown: experiencia usa años cuando la oferta pide un mínimo concreto", () => {
  let db = createEmptyDatabase();
  const experienceId = sectionId(db, "experience");
  const created = createElement(db, {
    sectionId: experienceId,
    variantName: "Original",
    fields: {
      role: "Software Engineer",
      company: "Acme",
      dateRange: { start: "2018-01-01", end: "2024-01-01" },
    },
  });
  db = created.db;

  const selection = [{ sectionDefinitionId: experienceId, items: [{ elementId: created.element.id, variantId: created.variant.id }] }];
  const breakdown = computeScoreBreakdown(db, selection, "Se requiere un mínimo de 5 años de experiencia");
  assert.equal(breakdown.experience.score, 100); // 6 años >= 5 requeridos, capado a 100
  assert.ok(breakdown.experience.detail.includes("5"));
});

test("computeScoreBreakdown: experiencia refleja no llegar al mínimo de años pedido", () => {
  let db = createEmptyDatabase();
  const experienceId = sectionId(db, "experience");
  const created = createElement(db, {
    sectionId: experienceId,
    variantName: "Original",
    fields: {
      role: "Junior Developer",
      company: "Acme",
      dateRange: { start: "2023-01-01", end: "2024-01-01" },
    },
  });
  db = created.db;

  const selection = [{ sectionDefinitionId: experienceId, items: [{ elementId: created.element.id, variantId: created.variant.id }] }];
  const breakdown = computeScoreBreakdown(db, selection, "Se requiere un mínimo de 5 años de experiencia");
  assert.ok(breakdown.experience.score < 100);
  assert.ok(breakdown.experience.score > 0);
});

test("computeScoreBreakdown: sin ningún número de años en la oferta, experiencia cae a cobertura de keywords", () => {
  let db = createEmptyDatabase();
  const experienceId = sectionId(db, "experience");
  const created = createElement(db, {
    sectionId: experienceId,
    variantName: "Original",
    fields: { role: "React Developer", company: "Acme" },
  });
  db = created.db;

  const selection = [{ sectionDefinitionId: experienceId, items: [{ elementId: created.element.id, variantId: created.variant.id }] }];
  const breakdown = computeScoreBreakdown(db, selection, "React developer needed, no specific years mentioned");
  assert.ok(breakdown.experience.score > 0);
  assert.ok(breakdown.experience.detail.includes("no especifica"));
});

test("computeScoreBreakdown: 'current: true' cuenta el puesto hasta hoy para calcular años", () => {
  let db = createEmptyDatabase();
  const experienceId = sectionId(db, "experience");
  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
  const created = createElement(db, {
    sectionId: experienceId,
    variantName: "Original",
    fields: {
      role: "Engineer",
      company: "Acme",
      dateRange: { start: tenYearsAgo.toISOString().slice(0, 10), current: true },
    },
  });
  db = created.db;

  const selection = [{ sectionDefinitionId: experienceId, items: [{ elementId: created.element.id, variantId: created.variant.id }] }];
  const breakdown = computeScoreBreakdown(db, selection, "Mínimo 5 años de experiencia");
  assert.equal(breakdown.experience.score, 100);
});

test("matchDatabaseToJobDescription incluye el desglose por categoría en el resultado", () => {
  const db = createEmptyDatabase();
  const result = matchDatabaseToJobDescription(db, "React developer needed");
  assert.ok(result.scoreBreakdown);
  assert.ok("education" in result.scoreBreakdown);
  assert.ok("technologies" in result.scoreBreakdown);
  assert.ok("experience" in result.scoreBreakdown);
});

// ---------- peso de keywords técnicas ----------

test("una keyword tecnológica reconocida pesa más que una genérica de la misma frecuencia (buildJobKeywordScores)", () => {
  const keywords = buildJobKeywordScores("Python y buen candidato");
  const pythonKw = keywords.find((k) => k.display === "python")!;
  const candidatoKw = keywords.find((k) => k.display === "candidato");
  assert.ok(pythonKw.isTech);
  assert.ok(pythonKw.weight > pythonKw.totalCount);
  assert.equal(candidatoKw, undefined); // "candidato" es ruido genérico, se filtra como stopword
});

test("matchDatabaseToJobDescription prioriza un proyecto con tecnologías reconocidas sobre uno con más menciones genéricas", () => {
  let db = createEmptyDatabase();
  const projectsId = sectionId(db, "projects");
  const techProject = createElement(db, {
    sectionId: projectsId,
    variantName: "Original",
    fields: { title: "Vision System", description: plainTextToRichText("Built with OpenCV and TensorFlow.") },
  });
  db = techProject.db;
  const genericProject = createElement(db, {
    sectionId: projectsId,
    variantName: "Original",
    fields: {
      title: "Team Project",
      description: plainTextToRichText("Worked with a great team on a wonderful opportunity for the company."),
    },
  });
  db = genericProject.db;

  const result = matchDatabaseToJobDescription(
    db,
    "Buscamos alguien con experiencia en OpenCV y TensorFlow para un gran equipo en una empresa excelente",
    { maxItemsPerSection: 1 }
  );
  const projectsSection = result.sections.find((s) => s.sectionDefinitionId === projectsId)!;
  const defaultItem = projectsSection.items.find((i) => i.defaultIncluded);
  assert.equal(defaultItem?.elementId, techProject.element.id);
});

// ---------- filterVariantsByLanguageTag ----------

test("filterVariantsByLanguageTag se queda solo con las variantes etiquetadas para ese idioma", () => {
  const variants = [
    { id: "1", elementId: "e", name: "Base - vES", fields: {}, createdAt: "", updatedAt: "" },
    { id: "2", elementId: "e", name: "Base - vEN", fields: {}, createdAt: "", updatedAt: "" },
  ] as any;
  assert.deepEqual(
    filterVariantsByLanguageTag(variants, "es").map((v: any) => v.id),
    ["1"]
  );
  assert.deepEqual(
    filterVariantsByLanguageTag(variants, "en").map((v: any) => v.id),
    ["2"]
  );
});

test("filterVariantsByLanguageTag devuelve TODAS las variantes si ninguna lleva la etiqueta (compatibilidad hacia atrás)", () => {
  const variants = [
    { id: "1", elementId: "e", name: "Original", fields: {}, createdAt: "", updatedAt: "" },
    { id: "2", elementId: "e", name: "Backend focus", fields: {}, createdAt: "", updatedAt: "" },
  ] as any;
  assert.equal(filterVariantsByLanguageTag(variants, "es").length, 2);
});

test("filterVariantsByLanguageTag no filtra nada si no se detectó idioma (null)", () => {
  const variants = [{ id: "1", elementId: "e", name: "Base - vES", fields: {}, createdAt: "", updatedAt: "" }] as any;
  assert.equal(filterVariantsByLanguageTag(variants, null).length, 1);
});

// ---------- optimización de variante en secciones siempre-incluidas ----------

test("summary/skills/personal-information eligen la VARIANTE que mejor encaja, pero siguen incluyéndose aunque ninguna encaje", () => {
  let db = createEmptyDatabase();
  const profileId = sectionId(db, "profile");
  const created = createElement(db, {
    sectionId: profileId,
    variantName: "Backend focus",
    fields: { summary: plainTextToRichText("Backend engineer with Node.js and PostgreSQL experience.") },
  });
  db = created.db;
  const forked = forkVariant(db, created.variant.id, "Frontend focus", {
    summary: plainTextToRichText("Frontend engineer with React and TypeScript experience."),
  });
  db = forked.db;

  const result = matchDatabaseToJobDescription(db, "Looking for a React and TypeScript frontend developer");
  const profileSection = result.sections.find((s) => s.sectionDefinitionId === profileId)!;
  assert.equal(profileSection.items[0]!.defaultIncluded, true); // siempre incluido
  assert.equal(profileSection.items[0]!.variantId, forked.variant.id); // pero la variante elegida es la que mejor encaja
});

test("summary se sigue incluyendo aunque NINGUNA variante coincida con la oferta (score 0)", () => {
  let db = createEmptyDatabase();
  const profileId = sectionId(db, "profile");
  db = createElement(db, {
    sectionId: profileId,
    variantName: "Original",
    fields: { summary: plainTextToRichText("Nada relacionado con la oferta en absoluto.") },
  }).db;

  const result = matchDatabaseToJobDescription(db, "React and TypeScript developer needed");
  const profileSection = result.sections.find((s) => s.sectionDefinitionId === profileId)!;
  assert.equal(profileSection.items[0]!.defaultIncluded, true);
  assert.equal(profileSection.items[0]!.score, 0);
});

test("cada item expone availableVariants con todas las variantes existentes del elemento", () => {
  let db = createEmptyDatabase();
  const projectsId = sectionId(db, "projects");
  const created = createElement(db, {
    sectionId: projectsId,
    variantName: "Backend focus",
    fields: { title: "Inventory System", description: plainTextToRichText("Python backend.") },
  });
  db = created.db;
  const forked = forkVariant(db, created.variant.id, "Frontend focus", {
    title: "Inventory System",
    description: plainTextToRichText("React frontend."),
  });
  db = forked.db;

  const result = matchDatabaseToJobDescription(db, "React developer");
  const projectsSection = result.sections.find((s) => s.sectionDefinitionId === projectsId)!;
  const item = projectsSection.items.find((i) => i.elementId === created.element.id)!;
  assert.equal(item.availableVariants.length, 2);
  assert.ok(item.availableVariants.some((v) => v.variantId === created.variant.id));
  assert.ok(item.availableVariants.some((v) => v.variantId === forked.variant.id));
});

// ---------- detección de idioma en el resultado ----------

test("matchDatabaseToJobDescription expone el idioma detectado de la oferta", () => {
  const db = createEmptyDatabase();
  const esResult = matchDatabaseToJobDescription(
    db,
    "Buscamos un desarrollador con experiencia en Python para nuestro equipo de trabajo"
  );
  assert.equal(esResult.detectedLanguage, "es");

  const enResult = matchDatabaseToJobDescription(
    db,
    "We are looking for a developer with experience in Python for our team"
  );
  assert.equal(enResult.detectedLanguage, "en");
});

test("scoreAllVariantsForElement respeta el filtro de idioma al puntuar variantes", () => {
  let db = createEmptyDatabase();
  const profileId = sectionId(db, "profile");
  const created = createElement(db, {
    sectionId: profileId,
    variantName: "Resumen - vES",
    fields: { summary: plainTextToRichText("Ingeniero con experiencia en Python.") },
  });
  db = created.db;
  const forkedEn = forkVariant(db, created.variant.id, "Resumen - vEN", {
    summary: plainTextToRichText("Engineer with Python experience."),
  });
  db = forkedEn.db;

  const section = db.sections.find((s) => s.id === profileId)!;
  const element = db.elements.find((e) => e.id === created.element.id)!;
  const keywords = buildJobKeywordScores("Python");

  const esOnly = scoreAllVariantsForElement(element, db.variants, section, keywords, "es");
  assert.equal(esOnly.length, 1);
  assert.equal(esOnly[0]!.variantId, created.variant.id);

  const enOnly = scoreAllVariantsForElement(element, db.variants, section, keywords, "en");
  assert.equal(enOnly.length, 1);
  assert.equal(enOnly[0]!.variantId, forkedEn.variant.id);
});

// ---------- guessCompanyName ----------

test("guessCompanyName detecta un nombre de empresa con sufijo legal reconocible", () => {
  const text = "Estamos en Acme Robotics S.L. buscando un ingeniero de visión artificial.";
  assert.equal(guessCompanyName(text), "Acme Robotics S.L.");
});

test("guessCompanyName detecta un nombre de empresa tras un marcador claro ('at', 'join', 'empresa')", () => {
  assert.equal(guessCompanyName("Senior Backend Engineer at Globex Corp\n\nWe are looking..."), "Globex Corp");
  assert.equal(guessCompanyName("Join Acme Robotics! Buscamos talento."), "Acme Robotics");
  assert.equal(guessCompanyName("La empresa Contoso Solutions busca un desarrollador."), "Contoso Solutions");
});

test("guessCompanyName cae al heurístico de primera línea si no encuentra ningún patrón de empresa", () => {
  assert.equal(guessCompanyName("Senior React Developer\n\nBuscamos a alguien con experiencia en React."), "Senior React Developer");
});

test("guessCompanyName no confunde una tecnología tras una preposición genérica con una empresa", () => {
  // "con Python" no debe interpretarse como nombre de empresa — "con" no está en la lista de marcadores.
  const result = guessCompanyName("Buscamos un desarrollador con Python y Django.");
  assert.notEqual(result, "Python");
});

// ---------- selectionFromCvVersion ----------

test("selectionFromCvVersion convierte las secciones de un CV real al formato de selección", () => {
  let db = createEmptyDatabase();
  const projectsId = sectionId(db, "projects");
  const created = createElement(db, { sectionId: projectsId, variantName: "Original", fields: { title: "X" } });
  db = created.db;
  const templateResult = createTemplate(db, { name: "T" });
  db = templateResult.db;
  const { db: withProject, version } = createCVProject(db, { name: "Test", templateId: templateResult.template.id });
  db = withProject;
  db = setSectionItems(db, version.id, projectsId, [{ elementId: created.element.id, variantId: created.variant.id }]);

  const selection = selectionFromCvVersion(db, version.id);
  const projectsSelection = selection.find((s) => s.sectionDefinitionId === projectsId);
  assert.deepEqual(projectsSelection?.items, [{ elementId: created.element.id, variantId: created.variant.id }]);
});

test("selectionFromCvVersion devuelve vacío para una versión inexistente", () => {
  const db = createEmptyDatabase();
  assert.deepEqual(selectionFromCvVersion(db, "no-existe"), []);
});

// ---------- computeItemCategoryImpacts ----------

test("computeItemCategoryImpacts calcula cuánto sube Educación al incluir un elemento de la sección Education", () => {
  let db = createEmptyDatabase();
  const educationId = sectionId(db, "education");
  const created = createElement(db, {
    sectionId: educationId,
    variantName: "Original",
    fields: { degree: "Ingeniería Informática", institution: "Universidad Ejemplo" },
  });
  db = created.db;

  const impacts = computeItemCategoryImpacts(
    db,
    [{ sectionDefinitionId: educationId, items: [] }],
    "Se requiere titulación en Ingeniería Informática",
    educationId,
    created.element.id,
    created.variant.id
  );
  assert.equal(impacts.education.withoutScore, 0);
  assert.ok(impacts.education.withScore > 0);
  assert.equal(impacts.education.delta, impacts.education.withScore - impacts.education.withoutScore);
});

test("computeItemCategoryImpacts.experience es null para secciones que no son Experience (p.ej. Projects)", () => {
  let db = createEmptyDatabase();
  const projectsId = sectionId(db, "projects");
  const created = createElement(db, { sectionId: projectsId, variantName: "Original", fields: { title: "X" } });
  db = created.db;

  const impacts = computeItemCategoryImpacts(
    db,
    [{ sectionDefinitionId: projectsId, items: [] }],
    "React developer",
    projectsId,
    created.element.id,
    created.variant.id
  );
  assert.equal(impacts.experience, null);
});

test("computeItemCategoryImpacts calcula Tecnologías para un elemento de la sección Skills", () => {
  let db = createEmptyDatabase();
  const skillsId = sectionId(db, "skills");
  const created = createElement(db, {
    sectionId: skillsId,
    variantName: "Original",
    fields: { programmingLanguages: ["Python"], technologies: [] },
  });
  db = created.db;

  const impacts = computeItemCategoryImpacts(
    db,
    [{ sectionDefinitionId: skillsId, items: [] }],
    "Python developer needed",
    skillsId,
    created.element.id,
    created.variant.id
  );
  assert.ok(impacts.technologies.withScore > 0);
});

test("computeItemCategoryImpacts: un PROYECTO puede aportar a Tecnologías (petición explícita: cada proyecto debe mostrar su contribución)", () => {
  let db = createEmptyDatabase();
  const projectsId = sectionId(db, "projects");
  const created = createElement(db, {
    sectionId: projectsId,
    variantName: "Original",
    fields: { title: "Vision System", description: plainTextToRichText("Built with OpenCV and TensorFlow.") },
  });
  db = created.db;

  const impacts = computeItemCategoryImpacts(
    db,
    [{ sectionDefinitionId: projectsId, items: [] }],
    "Looking for OpenCV and TensorFlow experience",
    projectsId,
    created.element.id,
    created.variant.id
  );
  assert.ok(impacts.technologies.delta > 0);
});

test("computeItemCategoryImpacts: un mismo item puede aportar a Educación Y Tecnologías A LA VEZ (petición explícita)", () => {
  let db = createEmptyDatabase();
  const projectsId = sectionId(db, "projects");
  const created = createElement(db, {
    sectionId: projectsId,
    variantName: "Original",
    fields: {
      title: "TFG Universidad",
      description: plainTextToRichText("Trabajo de fin de grado en la Universidad sobre Python y Docker."),
    },
  });
  db = created.db;

  const impacts = computeItemCategoryImpacts(
    db,
    [{ sectionDefinitionId: projectsId, items: [] }],
    "Se requiere experiencia en Universidad, Python y Docker",
    projectsId,
    created.element.id,
    created.variant.id
  );
  assert.ok(impacts.education.delta > 0);
  assert.ok(impacts.technologies.delta > 0);
});

test("computeItemCategoryImpacts: personal-information/profile también pueden aportar a Educación/Tecnologías si su contenido las menciona", () => {
  let db = createEmptyDatabase();
  const profileId = sectionId(db, "profile");
  const created = createElement(db, {
    sectionId: profileId,
    variantName: "Original",
    fields: { summary: plainTextToRichText("Ingeniero graduado en la Universidad con experiencia en Python.") },
  });
  db = created.db;

  const impacts = computeItemCategoryImpacts(
    db,
    [{ sectionDefinitionId: profileId, items: [] }],
    "Se busca Ingeniero de Universidad con experiencia en Python",
    profileId,
    created.element.id,
    created.variant.id
  );
  assert.ok(impacts.education.delta > 0);
  assert.ok(impacts.technologies.delta > 0);
});

// ---------- computeCategorizedKeywordComparison ----------

test("computeCategorizedKeywordComparison reparte presentes/ausentes por Educación/Tecnologías/Experiencia", () => {
  let db = createEmptyDatabase();
  const educationId = sectionId(db, "education");
  const skillsId = sectionId(db, "skills");
  const educationEl = createElement(db, {
    sectionId: educationId,
    variantName: "Original",
    fields: { degree: "Ingeniería Informática" },
  });
  db = educationEl.db;
  const skillsEl = createElement(db, {
    sectionId: skillsId,
    variantName: "Original",
    fields: { programmingLanguages: ["Python"] },
  });
  db = skillsEl.db;

  const selection = [
    { sectionDefinitionId: educationId, items: [{ elementId: educationEl.element.id, variantId: educationEl.variant.id }] },
    { sectionDefinitionId: skillsId, items: [{ elementId: skillsEl.element.id, variantId: skillsEl.variant.id }] },
  ];

  const comparison = computeCategorizedKeywordComparison(db, selection, "Ingeniería Informática, Python, Docker");
  assert.ok(comparison.education.present.some((k) => k.toLowerCase().includes("ingenieria") || k.toLowerCase().includes("informatica")));
  assert.ok(comparison.technologies.present.some((k) => k.toLowerCase() === "python"));
  assert.ok(comparison.technologies.missing.some((k) => k.toLowerCase() === "docker"));
});

test("computeCategorizedKeywordComparison: technologies detecta menciones en Projects, no solo en Skills", () => {
  let db = createEmptyDatabase();
  const projectsId = sectionId(db, "projects");
  const created = createElement(db, {
    sectionId: projectsId,
    variantName: "Original",
    fields: { title: "X", description: plainTextToRichText("Built with React and Docker.") },
  });
  db = created.db;

  const comparison = computeCategorizedKeywordComparison(
    db,
    [{ sectionDefinitionId: projectsId, items: [{ elementId: created.element.id, variantId: created.variant.id }] }],
    "React and Docker developer"
  );
  assert.ok(comparison.technologies.present.some((k) => k.toLowerCase() === "react"));
  assert.ok(comparison.technologies.present.some((k) => k.toLowerCase() === "docker"));
});

test("regresión: una oferta larga con mucho relleno genérico NO debe hacer que Educación/Tecnologías se pierdan por quedar fuera del top-N general", () => {
  // Antes de la corrección, computeKeywordClassCoverageScore recortaba
  // primero al top-40 general y DESPUÉS filtraba por categoría — con una
  // oferta larga, términos como "master"/"universidad" quedaban fuera del
  // top-40 (aplastados por relleno genérico repetido) y la categoría
  // entera salía en 0% aunque la oferta los mencionara de verdad.
  let db = createEmptyDatabase();
  const educationId = sectionId(db, "education");
  const created = createElement(db, {
    sectionId: educationId,
    variantName: "Original",
    fields: { degree: "Master en Inteligencia Artificial", institution: "Universidad Complutense" },
  });
  db = created.db;

  // Mucho relleno genérico (cada palabra repetida 2-3 veces) para que
  // "master"/"universidad" (mencionadas solo 1 vez cada una) queden fuera
  // de cualquier recorte al top-40 si el bug siguiera presente.
  const filler = Array.from(
    { length: 45 },
    (_, i) => `palabraunica${i} palabraunica${i}`
  ).join(" ");
  const jobText = `Se requiere titulación de Master y experiencia universitaria. ${filler}`;

  const selection = [{ sectionDefinitionId: educationId, items: [{ elementId: created.element.id, variantId: created.variant.id }] }];
  const breakdown = computeScoreBreakdown(db, selection, jobText);
  assert.ok(breakdown.education.score > 0, "Educación no debería salir en 0% aunque la oferta tenga mucho relleno genérico");

  const impacts = computeItemCategoryImpacts(db, selection, jobText, educationId, created.element.id, created.variant.id);
  assert.ok(impacts.education.delta > 0, "El item de Educación debería mostrar una contribución real, no 0");
});

test("regresión: con una oferta larga, un item puede seguir mostrando contribución a Tecnologías Y Educación a la vez", () => {
  let db = createEmptyDatabase();
  const projectsId = sectionId(db, "projects");
  const created = createElement(db, {
    sectionId: projectsId,
    variantName: "Original",
    fields: {
      title: "TFG Universidad",
      description: plainTextToRichText("Trabajo de fin de grado en la Universidad usando Python y Docker."),
    },
  });
  db = created.db;

  const filler = Array.from({ length: 45 }, (_, i) => `palabraunica${i} palabraunica${i}`).join(" ");
  const jobText = `Se requiere experiencia en Universidad, Python y Docker. ${filler}`;

  const impacts = computeItemCategoryImpacts(
    db,
    [{ sectionDefinitionId: projectsId, items: [] }],
    jobText,
    projectsId,
    created.element.id,
    created.variant.id
  );
  assert.ok(impacts.education.delta > 0, "Debería aportar a Educación");
  assert.ok(impacts.technologies.delta > 0, "Debería aportar a Tecnologías a la vez");
});
