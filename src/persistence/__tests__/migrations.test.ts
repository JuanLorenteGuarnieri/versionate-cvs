import test from "node:test";
import assert from "node:assert/strict";
import { addSectionDefinition, createEmptyDatabase, STANDARD_SECTION_KEY_ORDER } from "../../domain/database.js";
import { createTemplate } from "../../domain/templates.js";
import { DatabaseValidationError, migrateRawDatabase } from "../migrations.js";

test("una AppDatabase válida y actual pasa sin cambios", () => {
  const db = createEmptyDatabase();
  const result = migrateRawDatabase(JSON.parse(JSON.stringify(db)));
  assert.deepEqual(result, db);
});

test("rechaza null, arrays y primitivos con un error humano", () => {
  for (const bad of [null, [], "texto", 42, undefined]) {
    assert.throws(() => migrateRawDatabase(bad), DatabaseValidationError);
  }
});

test("rechaza un objeto sin formatVersion", () => {
  assert.throws(() => migrateRawDatabase({ sections: [] }), /formatVersion/);
});

test("rechaza una formatVersion más nueva que la que soporta esta versión de la app", () => {
  const db = { ...createEmptyDatabase(), formatVersion: 999 };
  assert.throws(() => migrateRawDatabase(db), /más nueva/);
});

test("rechaza un objeto con formatVersion correcta pero campos requeridos ausentes", () => {
  const db = createEmptyDatabase();
  const { elements, ...rest } = db as any;
  assert.throws(() => migrateRawDatabase(rest), /"elements"/);
});

test("rechaza si falta 'settings'", () => {
  const db = createEmptyDatabase();
  const { settings, ...rest } = db as any;
  assert.throws(() => migrateRawDatabase(rest), /settings/);
});

test("una versión antigua sin migración registrada da un error explicativo, no un crash silencioso", () => {
  const raw = { ...createEmptyDatabase(), formatVersion: 0 };
  assert.throws(() => migrateRawDatabase(raw), /No existe una ruta de migración/);
});

test("la migración v4->v5 renombra la sección 'profile' a 'Summary' solo si seguía con el título por defecto", () => {
  const base = createEmptyDatabase();
  const v4Db = {
    ...base,
    formatVersion: 4,
    sections: base.sections.map((s) => (s.key === "profile" ? { ...s, defaultTitle: "Profile" } : s)),
  };
  const migrated = migrateRawDatabase(v4Db);
  assert.equal(migrated.sections.find((s) => s.key === "profile")!.defaultTitle, "Summary");
});

test("la migración v4->v5 respeta un título de 'profile' ya personalizado por el usuario", () => {
  const base = createEmptyDatabase();
  const v4Db = {
    ...base,
    formatVersion: 4,
    sections: base.sections.map((s) => (s.key === "profile" ? { ...s, defaultTitle: "Sobre mí" } : s)),
  };
  const migrated = migrateRawDatabase(v4Db);
  assert.equal(migrated.sections.find((s) => s.key === "profile")!.defaultTitle, "Sobre mí");
});

test(
  "regresión: la migración v5->v6 fusiona 'skills'/'programming-languages'/'software-tools' en un " +
    "único elemento 'skills' con 3 listas, mueve los elementos antiguos a la papelera y actualiza los CVs " +
    "que los mostraban",
  () => {
    const base = createEmptyDatabase();
    // Simula el estado ANTES de esta sesión: 3 secciones separadas, cada
    // una con elementos "name"+"level" (schema v5 real).
    const skillsSection = { id: "sec-skills", key: "skills", isCustom: false, defaultTitle: "Skills", order: 10, createdAt: "", updatedAt: "", fieldSchema: [
      { id: "f1", key: "name", label: "Skill", type: "text", order: 0 },
      { id: "f2", key: "level", label: "Level", type: "select", order: 1 },
    ] };
    const progLangSection = { id: "sec-proglang", key: "programming-languages", isCustom: false, defaultTitle: "Programming languages", order: 11, createdAt: "", updatedAt: "", fieldSchema: [
      { id: "f3", key: "name", label: "Language", type: "text", order: 0 },
      { id: "f4", key: "level", label: "Level", type: "select", order: 1 },
    ] };
    const toolsSection = { id: "sec-tools", key: "software-tools", isCustom: false, defaultTitle: "Software / Tools", order: 12, createdAt: "", updatedAt: "", fieldSchema: [
      { id: "f5", key: "name", label: "Tool", type: "text", order: 0 },
    ] };

    const elements = [
      { id: "el-py", sectionId: "sec-proglang", variantIds: ["v-py"], defaultVariantId: "v-py", createdAt: "", updatedAt: "" },
      { id: "el-cpp", sectionId: "sec-proglang", variantIds: ["v-cpp"], defaultVariantId: "v-cpp", createdAt: "", updatedAt: "" },
      { id: "el-cv", sectionId: "sec-tools", variantIds: ["v-cv"], defaultVariantId: "v-cv", createdAt: "", updatedAt: "" },
      { id: "el-lead", sectionId: "sec-skills", variantIds: ["v-lead"], defaultVariantId: "v-lead", createdAt: "", updatedAt: "" },
    ];
    const variants = [
      { id: "v-py", elementId: "el-py", name: "Original", fields: { name: "Python", level: "Advanced" }, createdAt: "", updatedAt: "" },
      { id: "v-cpp", elementId: "el-cpp", name: "Original", fields: { name: "C++", level: "Intermediate" }, createdAt: "", updatedAt: "" },
      { id: "v-cv", elementId: "el-cv", name: "Original", fields: { name: "OpenCV" }, createdAt: "", updatedAt: "" },
      { id: "v-lead", elementId: "el-lead", name: "Original", fields: { name: "Leadership" }, createdAt: "", updatedAt: "" },
    ];

    // Una CV que SÍ tenía contenido seleccionado de estas 3 secciones (debe
    // conservar la visibilidad tras la fusión) y otra que NUNCA las usó
    // (debe seguir sin mostrarlas).
    const cvWithSkills = {
      id: "cv-1", projectId: "proj-1", label: "v1", templateId: "tpl-1", metadata: {}, createdAt: "", updatedAt: "",
      sections: [
        { sectionDefinitionId: "sec-skills", order: 10, items: [{ elementId: "el-lead", variantId: "v-lead", order: 0 }] },
        { sectionDefinitionId: "sec-proglang", order: 11, items: [{ elementId: "el-py", variantId: "v-py", order: 0 }, { elementId: "el-cpp", variantId: "v-cpp", order: 1 }] },
        { sectionDefinitionId: "sec-tools", order: 12, items: [{ elementId: "el-cv", variantId: "v-cv", order: 0 }] },
      ],
    };
    const cvWithoutSkills = {
      id: "cv-2", projectId: "proj-1", label: "v1", templateId: "tpl-1", metadata: {}, createdAt: "", updatedAt: "",
      sections: [
        { sectionDefinitionId: "sec-skills", order: 10, items: [] },
        { sectionDefinitionId: "sec-proglang", order: 11, items: [] },
        { sectionDefinitionId: "sec-tools", order: 12, items: [] },
      ],
    };

    const v5Db = {
      ...base,
      formatVersion: 5,
      sections: [...base.sections.filter((s) => s.key !== "skills"), skillsSection, progLangSection, toolsSection],
      elements,
      variants,
      cvVersions: [cvWithSkills, cvWithoutSkills],
    };

    const migrated = migrateRawDatabase(v5Db);
    assert.equal(migrated.formatVersion, 9);

    // Solo queda UNA sección "skills"; las otras 2 desaparecen.
    const skillsSections = migrated.sections.filter((s) => s.key === "skills");
    assert.equal(skillsSections.length, 1);
    assert.equal(migrated.sections.some((s) => s.key === "programming-languages"), false);
    assert.equal(migrated.sections.some((s) => s.key === "software-tools"), false);
    assert.deepEqual(
      skillsSections[0]!.fieldSchema.map((f) => f.key),
      ["programmingLanguages", "technologies", "softSkills"]
    );

    // Los 4 elementos antiguos ya no están activos...
    for (const id of ["el-py", "el-cpp", "el-cv", "el-lead"]) {
      assert.equal(migrated.elements.some((e) => e.id === id), false, `${id} no debe seguir activo`);
    }
    // ...pero SÍ están recuperables en la papelera.
    const trashedIds = migrated.trash.filter((t) => t.entityType === "element").map((t) => t.entityId);
    for (const id of ["el-py", "el-cpp", "el-cv", "el-lead"]) {
      assert.ok(trashedIds.includes(id), `${id} debe estar en la papelera`);
    }

    // Se crea un único elemento fusionado con los nombres agrupados por campo.
    const mergedElement = migrated.elements.find((e) => e.sectionId === "sec-skills")!;
    assert.ok(mergedElement, "debe existir el elemento fusionado");
    const mergedVariant = migrated.variants.find((v) => v.elementId === mergedElement.id)!;
    assert.deepEqual(mergedVariant.fields.programmingLanguages, ["Python", "C++"]);
    assert.deepEqual(mergedVariant.fields.technologies, ["OpenCV"]);
    assert.deepEqual(mergedVariant.fields.softSkills, ["Leadership"]);

    // El CV que SÍ mostraba contenido de estas secciones conserva un único
    // item apuntando al elemento fusionado.
    const migratedCv1 = migrated.cvVersions.find((v) => v.id === "cv-1")!;
    const skillsInstances1 = migratedCv1.sections.filter((s) => s.sectionDefinitionId === "sec-skills");
    assert.equal(skillsInstances1.length, 1, "las 3 instancias de sección se colapsan en una");
    assert.equal(skillsInstances1[0]!.items.length, 1);
    assert.equal(skillsInstances1[0]!.items[0]!.elementId, mergedElement.id);

    // El CV que NUNCA mostró contenido de estas secciones sigue sin mostrarlo.
    const migratedCv2 = migrated.cvVersions.find((v) => v.id === "cv-2")!;
    const skillsInstances2 = migratedCv2.sections.filter((s) => s.sectionDefinitionId === "sec-skills");
    assert.equal(skillsInstances2.length, 1);
    assert.equal(skillsInstances2[0]!.items.length, 0);
  }
);

test("la migración v6->v7 quita el campo de fecha de 'projects' y añade 'subtitle' justo después del título", () => {
  const base = createEmptyDatabase();
  const projectsSection = base.sections.find((s) => s.key === "projects")!;
  const v6ProjectsSection = {
    ...projectsSection,
    fieldSchema: [
      { id: "f1", key: "title", label: "Title", type: "text", order: 0 },
      { id: "f2", key: "description", label: "Description", type: "richtext", order: 1 },
      { id: "f3", key: "technologies", label: "Technologies", type: "tags", order: 2 },
      { id: "f4", key: "dateRange", label: "Dates", type: "daterange", order: 3 },
      { id: "f5", key: "url", label: "Links", type: "linklist", order: 4 },
    ],
  };
  const v6Db = { ...base, formatVersion: 6, sections: base.sections.map((s) => (s.key === "projects" ? v6ProjectsSection : s)) };

  const migrated = migrateRawDatabase(v6Db);
  const migratedProjects = migrated.sections.find((s) => s.key === "projects")!;
  const keys = [...migratedProjects.fieldSchema].sort((a, b) => a.order - b.order).map((f) => f.key);
  assert.deepEqual(keys, ["title", "subtitle", "description", "technologies", "url"]);
  assert.equal(migratedProjects.fieldSchema.some((f) => f.key === "dateRange"), false);
});

test("la migración v7->v8 añade 'languagesStyle' con los valores por defecto a templates que no lo tenían", () => {
  const { db: withTemplate } = createTemplate(createEmptyDatabase(), { name: "T1" });
  const v7Db = {
    ...withTemplate,
    formatVersion: 7,
    templates: withTemplate.templates.map((t) => {
      const { languagesStyle, ...rest } = t as unknown as Record<string, unknown>;
      return rest;
    }),
  };
  const migrated = migrateRawDatabase(v7Db);
  assert.equal(migrated.formatVersion, 9);
  for (const t of migrated.templates) {
    assert.deepEqual(t.languagesStyle, { alignment: "center", mode: "columns" });
  }
});

test("la migración v7->v8 no toca un template que ya tuviera 'languagesStyle' personalizado", () => {
  const { db: withTemplate, template } = createTemplate(createEmptyDatabase(), { name: "T1" });
  const v7Db = {
    ...withTemplate,
    formatVersion: 7,
    templates: withTemplate.templates.map((t) =>
      t.id === template.id ? { ...t, languagesStyle: { alignment: "left", mode: "list" } } : t
    ),
  };
  const migrated = migrateRawDatabase(v7Db);
  assert.deepEqual(migrated.templates.find((t) => t.id === template.id)!.languagesStyle, {
    alignment: "left",
    mode: "list",
  });
});

test(
  "regresión: migra un backup real formatVersion 2 (Links/URL como 'list'/'url' sueltos) a " +
    "'linklist', convirtiendo los valores existentes sin perder datos",
  () => {
    const base = createEmptyDatabase();
    const personalInfoSection = base.sections.find((s) => s.key === "personal-information")!;
    const projectsSection = base.sections.find((s) => s.key === "projects")!;

    // Fuerza los tipos de campo a como estaban ANTES de esta sesión (v2 real).
    const v2PersonalInfoSection = {
      ...personalInfoSection,
      fieldSchema: personalInfoSection.fieldSchema.map((f) => (f.key === "links" ? { ...f, type: "list" } : f)),
    };
    const v2ProjectsSection = {
      ...projectsSection,
      fieldSchema: projectsSection.fieldSchema.map((f) => (f.key === "url" ? { ...f, type: "url" } : f)),
    };

    const personalElement = { id: "el-pi", sectionId: "personal-information", variantIds: ["v-pi"], defaultVariantId: "v-pi", createdAt: "", updatedAt: "" };
    const personalVariant = {
      id: "v-pi",
      elementId: "el-pi",
      name: "Original",
      fields: { fullName: "Jane Doe", links: ["https://linkedin.com/in/jane", "https://github.com/jane"] },
      createdAt: "",
      updatedAt: "",
    };
    const projectElement = { id: "el-proj", sectionId: "projects", variantIds: ["v-proj"], defaultVariantId: "v-proj", createdAt: "", updatedAt: "" };
    const projectVariant = {
      id: "v-proj",
      elementId: "el-proj",
      name: "Original",
      fields: { title: "Mi proyecto", url: "https://example.com/proyecto" },
      createdAt: "",
      updatedAt: "",
    };

    const v2Db = {
      ...base,
      formatVersion: 2,
      sections: base.sections.map((s) => {
        if (s.key === "personal-information") return v2PersonalInfoSection;
        if (s.key === "projects") return v2ProjectsSection;
        return s;
      }),
      elements: [personalElement, projectElement],
      variants: [personalVariant, projectVariant],
    };

    const migrated = migrateRawDatabase(v2Db);
    assert.equal(migrated.formatVersion, 9);

    const migratedPersonalSection = migrated.sections.find((s) => s.key === "personal-information")!;
    assert.equal(migratedPersonalSection.fieldSchema.find((f) => f.key === "links")!.type, "linklist");
    const migratedProjectsSection = migrated.sections.find((s) => s.key === "projects")!;
    assert.equal(migratedProjectsSection.fieldSchema.find((f) => f.key === "url")!.type, "linklist");

    const migratedPersonalVariant = migrated.variants.find((v) => v.id === "v-pi")!;
    assert.deepEqual(migratedPersonalVariant.fields.links, [
      { label: "", url: "https://linkedin.com/in/jane" },
      { label: "", url: "https://github.com/jane" },
    ]);
    // No se pierde ningún otro campo por el camino.
    assert.equal(migratedPersonalVariant.fields.fullName, "Jane Doe");

    const migratedProjectVariant = migrated.variants.find((v) => v.id === "v-proj")!;
    assert.deepEqual(migratedProjectVariant.fields.url, [{ label: "", url: "https://example.com/proyecto" }]);
    assert.equal(migratedProjectVariant.fields.title, "Mi proyecto");
  }
);

test("la migración v2->v3 no toca elementos de secciones sin campos de enlace", () => {
  const base = createEmptyDatabase();
  const experienceSection = base.sections.find((s) => s.key === "experience")!;
  const element = { id: "el-exp", sectionId: "experience", variantIds: ["v-exp"], defaultVariantId: "v-exp", createdAt: "", updatedAt: "" };
  const variant = { id: "v-exp", elementId: "el-exp", name: "Original", fields: { role: "Dev" }, createdAt: "", updatedAt: "" };
  const v2Db = { ...base, formatVersion: 2, sections: base.sections, elements: [element], variants: [variant] };

  const migrated = migrateRawDatabase(v2Db);
  assert.equal(migrated.formatVersion, 9);
  assert.deepEqual(migrated.variants.find((v) => v.id === "v-exp")!.fields, { role: "Dev" });
  void experienceSection;
});

test(
  "regresión: la migración v3->v4 añade el campo 'location' a una sección 'education' " +
    "ya existente que no lo tenía (backfill, como con los parámetros de template en v1->v2)",
  () => {
    const base = createEmptyDatabase();
    const educationSection = base.sections.find((s) => s.key === "education")!;
    // Simula el schema de education ANTES de esta sesión (sin "location").
    const v3EducationSection = {
      ...educationSection,
      fieldSchema: educationSection.fieldSchema
        .filter((f) => f.key !== "location")
        .map((f, i) => ({ ...f, order: i })),
    };
    assert.equal(v3EducationSection.fieldSchema.some((f) => f.key === "location"), false);

    const v3Db = {
      ...base,
      formatVersion: 3,
      sections: base.sections.map((s) => (s.key === "education" ? v3EducationSection : s)),
    };

    const migrated = migrateRawDatabase(v3Db);
    assert.equal(migrated.formatVersion, 9);
    const migratedEducation = migrated.sections.find((s) => s.key === "education")!;
    const locationField = migratedEducation.fieldSchema.find((f) => f.key === "location");
    assert.ok(locationField, "debe existir el campo location tras migrar");
    assert.equal(locationField!.type, "text");
  }
);

test("la migración v3->v4 inserta 'location' justo después de 'institution', reordenando lo demás", () => {
  const base = createEmptyDatabase();
  const educationSection = base.sections.find((s) => s.key === "education")!;
  const v3EducationSection = {
    ...educationSection,
    fieldSchema: educationSection.fieldSchema.filter((f) => f.key !== "location").map((f, i) => ({ ...f, order: i })),
  };
  const v3Db = { ...base, formatVersion: 3, sections: base.sections.map((s) => (s.key === "education" ? v3EducationSection : s)) };

  const migrated = migrateRawDatabase(v3Db);
  const migratedEducation = migrated.sections.find((s) => s.key === "education")!;
  const keys = [...migratedEducation.fieldSchema].sort((a, b) => a.order - b.order).map((f) => f.key);
  assert.deepEqual(keys, ["degree", "institution", "location", "dateRange", "description"]);
  assert.equal(migratedEducation.fieldSchema.find((f) => f.key === "location")!.type, "text");
});

test("la migración v3->v4 no toca una sección 'education' que YA tiene 'location' (idempotente)", () => {
  const base = createEmptyDatabase(); // ya viene con "location" de fábrica desde esta sesión
  const v3Db = { ...base, formatVersion: 3 };
  const migrated = migrateRawDatabase(v3Db);
  const migratedEducation = migrated.sections.find((s) => s.key === "education")!;
  assert.equal(migratedEducation.fieldSchema.filter((f) => f.key === "location").length, 1);
});

test(
  "regresión: migra un backup real formatVersion 1 (con templates sin linkStyle ni los " +
    "parámetros nuevos de tipografía) sin reventar, y rellena valores por defecto razonables",
  () => {
    // Forma real de un template formatVersion 1, tal como lo exportó una
    // sesión anterior de esta app — comprobado contra un backup real:
    // linkStyle NO es un objeto vacío, la clave no existe en absoluto.
    const v1Template = {
      id: "tpl-1",
      name: "Default",
      derivedFromTemplateId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      typography: { fontFamily: "Inter", baseFontSize: 8, lineHeight: 1.35, headingScale: 1.15 },
      colors: { text: "#111", background: "#fff", accent: "#00f", muted: "#888", border: "#ddd" },
      spacing: { sectionGap: 14, itemGap: 8, margins: { top: 16, right: 16, bottom: 16, left: 16 } },
      sectionTitleStyle: {},
      headerStyle: {},
      dateStyle: {},
      bulletStyle: {},
      separators: {},
      // sin "linkStyle" en absoluto
    };
    // v1 pasa por v2 y luego por v2->v3 automáticamente: hace falta que las
    // secciones/elementos/variantes también sean válidos para esa segunda
    // migración (createEmptyDatabase ya trae secciones/elements/variants
    // vacíos, así que no hay nada que migrar ahí, solo el template).
    const v1Db = { ...createEmptyDatabase(), formatVersion: 1, templates: [v1Template] };

    const migrated = migrateRawDatabase(v1Db);

    assert.equal(migrated.formatVersion, 9);
    const template = migrated.templates[0]!;
    // No debe reventar al leer estos campos (antes de la migración,
    // template.linkStyle era undefined y template.linkStyle.appearance
    // lanzaba TypeError).
    assert.equal((template.linkStyle as Record<string, unknown>).appearance, undefined);
    assert.deepEqual(template.linkStyle, {});
    assert.equal(template.typography.fontWeight, 400);
    assert.equal(template.typography.headingWeight, 700);
    assert.equal(template.typography.headingCase, "uppercase");
    assert.equal(template.typography.textAlignment, "left");
    assert.equal(template.spacing.paragraphSpacing, 4);
    // Los valores YA presentes en el v1 no se pisan.
    assert.equal(template.typography.fontFamily, "Inter");
    assert.equal(template.typography.baseFontSize, 8);
    assert.equal(template.spacing.sectionGap, 14);
  }
);

test("la migración v8->v9 recoloca 'skills' entre 'profile' y 'experience' según el orden canónico", () => {
  const db = createEmptyDatabase();
  const OLD_ORDER = [
    "personal-information",
    "profile",
    "experience",
    "education",
    "projects",
    "skills",
    "languages",
    "certifications",
    "awards",
    "publications",
    "courses",
    "volunteering",
    "references",
  ];
  const oldRaw = {
    ...db,
    formatVersion: 8,
    sections: db.sections.map((s) => ({ ...s, order: OLD_ORDER.indexOf(s.key) })),
  };

  const migrated = migrateRawDatabase(oldRaw);
  assert.equal(migrated.formatVersion, 9);
  const orderedKeys = [...migrated.sections].sort((a, b) => a.order - b.order).map((s) => s.key);
  assert.deepEqual(orderedKeys, [...STANDARD_SECTION_KEY_ORDER]);
});

test("la migración v8->v9 conserva el orden relativo de las secciones custom, desplazadas después de las estándar", () => {
  let db = createEmptyDatabase();
  const first = addSectionDefinition(db, { defaultTitle: "Hobbies", fields: [] });
  db = first.db;
  const second = addSectionDefinition(db, { defaultTitle: "Portfolio", fields: [] });
  db = second.db;

  // Simula una base de datos v8 donde una sección custom se creó ANTES
  // que alguna estándar (orden intercalado, como podía pasar antes de
  // esta migración).
  const oldRaw = {
    ...db,
    formatVersion: 8,
    sections: db.sections.map((s) => (s.key === "references" ? { ...s, order: -1 } : s)),
  };

  const migrated = migrateRawDatabase(oldRaw);
  const orderedKeys = [...migrated.sections].sort((a, b) => a.order - b.order).map((s) => s.key);
  const standardCount = STANDARD_SECTION_KEY_ORDER.length;
  // Las estándar (salvo 'references', forzada a -1 artificialmente en el fixture) ocupan las primeras posiciones...
  assert.deepEqual(orderedKeys.slice(0, standardCount), [...STANDARD_SECTION_KEY_ORDER]);
  // ...y las dos custom, en su mismo orden relativo de creación, van justo después.
  assert.deepEqual(orderedKeys.slice(standardCount), [first.section.id, second.section.id].map((id) => migrated.sections.find((s: any) => s.id === id)!.key));
});
