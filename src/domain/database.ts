import type {
  AppDatabase,
  FieldDefinition,
  FieldType,
  SectionDefinition,
} from "./model/types.js";
import { CURRENT_FORMAT_VERSION } from "./model/types.js";
import { createId, nowIso } from "./ids.js";

function field(
  key: string,
  label: string,
  type: FieldType,
  order: number,
  required = false
): FieldDefinition {
  return { id: createId(), key, label, type, order, required };
}

/**
 * Orden canónico de las secciones estándar — DEBE mantenerse en el mismo
 * orden que el array `specs` de `buildDefaultSections`, justo debajo (hay
 * un test en database.test.ts que lo comprueba automáticamente si algún
 * día divergen). Se expone aparte, como una simple lista de keys sin
 * campos ni ids, para que `migrations.ts` pueda recalcular el `order` de
 * bases de datos ya existentes cuando cambia este orden (ver migración
 * v8->v9) sin tener que duplicar toda la definición de campos.
 */
export const STANDARD_SECTION_KEY_ORDER = [
  "personal-information",
  "profile",
  "skills",
  "experience",
  "education",
  "projects",
  "languages",
  "certifications",
  "awards",
  "publications",
  "courses",
  "volunteering",
  "references",
] as const;

/**
 * Definición de las secciones estándar de §3 del contexto del proyecto.
 * El usuario puede añadir campos a cualquiera de ellas más adelante
 * (incluso a las no-custom, ver ARCHITECTURE.md §18-9), y puede crear
 * secciones custom nuevas con `addSectionDefinition`.
 *
 * Orden: Skills va justo después de Summary y antes de Experience
 * (petición explícita del usuario — antes iba después de Projects, casi al
 * final). Ver migración v8->v9 en persistence/migrations.ts para las bases
 * de datos ya existentes, donde este orden no se aplica solo, hay que
 * migrarlo.
 */
function buildDefaultSections(): SectionDefinition[] {
  const timestamp = nowIso();

  const specs: Array<{ key: string; defaultTitle: string; fields: FieldDefinition[] }> = [
    {
      key: "personal-information",
      defaultTitle: "Personal information",
      fields: [
        field("fullName", "Full name", "text", 0, true),
        field("headline", "Headline / role", "text", 1),
        field("email", "Email", "text", 2),
        field("phone", "Phone", "text", 3),
        field("location", "Location", "text", 4),
        field("links", "Links (portfolio, GitHub, LinkedIn...)", "linklist", 5),
      ],
    },
    {
      key: "profile",
      defaultTitle: "Summary",
      fields: [field("summary", "Summary", "richtext", 0)],
    },
    {
      // Fusión de las antiguas secciones "skills"/"programming-languages"/
      // "software-tools" (petición explícita del usuario) en UNA sola
      // sección con 3 campos de listas de etiquetas — no es "un item por
      // habilidad" como el resto de secciones, sino un único item (como
      // "Personal information") con 3 campos, cada uno mostrado solo si
      // tiene contenido. Ver preview.ts (buildSkillsLayout) y CVPreview.tsx
      // para el renderer específico de esta sección (líneas "Etiqueta:
      // valores", sin el estilo de "píldora" que sí usan Technologies en
      // Experience/Projects). Migración v5->v6 (migrations.ts) para bases
      // de datos ya existentes.
      key: "skills",
      defaultTitle: "Skills",
      fields: [
        field("programmingLanguages", "Programming Languages", "tags", 0),
        field("technologies", "Technologies", "tags", 1),
        field("softSkills", "Soft Skills", "tags", 2),
      ],
    },
    {
      key: "experience",
      defaultTitle: "Experience",
      fields: [
        field("role", "Role", "text", 0, true),
        field("company", "Company", "text", 1, true),
        field("location", "Location", "text", 2),
        field("dateRange", "Dates", "daterange", 3),
        field("description", "Description", "richtext", 4),
        field("technologies", "Technologies", "tags", 5),
      ],
    },
    {
      key: "education",
      defaultTitle: "Education",
      fields: [
        field("degree", "Degree", "text", 0, true),
        field("institution", "Institution", "text", 1, true),
        field("location", "Location", "text", 2),
        field("dateRange", "Dates", "daterange", 3),
        field("description", "Description", "richtext", 4),
      ],
    },
    {
      key: "projects",
      defaultTitle: "Projects",
      fields: [
        field("title", "Title", "text", 0, true),
        field("subtitle", "Subtitle", "text", 1),
        field("description", "Description", "richtext", 2),
        field("technologies", "Technologies", "tags", 3),
        field("url", "Links", "linklist", 4),
      ],
    },
    {
      key: "languages",
      defaultTitle: "Languages",
      fields: [
        field("name", "Language", "text", 0, true),
        field("level", "Level", "select", 1),
      ],
    },
    {
      key: "certifications",
      defaultTitle: "Certifications",
      fields: [
        field("name", "Name", "text", 0, true),
        field("issuer", "Issuer", "text", 1),
        field("date", "Date", "date", 2),
        field("url", "Links", "linklist", 3),
      ],
    },
    {
      key: "awards",
      defaultTitle: "Awards",
      fields: [
        field("title", "Title", "text", 0, true),
        field("issuer", "Issuer", "text", 1),
        field("date", "Date", "date", 2),
        field("description", "Description", "richtext", 3),
      ],
    },
    {
      key: "publications",
      defaultTitle: "Publications",
      fields: [
        field("title", "Title", "text", 0, true),
        field("venue", "Venue", "text", 1),
        field("date", "Date", "date", 2),
        field("url", "Links", "linklist", 3),
      ],
    },
    {
      key: "courses",
      defaultTitle: "Courses",
      fields: [
        field("title", "Title", "text", 0, true),
        field("institution", "Institution", "text", 1),
        field("date", "Date", "date", 2),
      ],
    },
    {
      key: "volunteering",
      defaultTitle: "Volunteering",
      fields: [
        field("role", "Role", "text", 0, true),
        field("organization", "Organization", "text", 1),
        field("dateRange", "Dates", "daterange", 2),
        field("description", "Description", "richtext", 3),
      ],
    },
    {
      key: "references",
      defaultTitle: "References",
      fields: [
        field("name", "Name", "text", 0, true),
        field("relation", "Relation", "text", 1),
        field("contact", "Contact", "text", 2),
      ],
    },
  ];

  return specs.map((spec, index) => ({
    id: spec.key,
    key: spec.key,
    isCustom: false,
    defaultTitle: spec.defaultTitle,
    fieldSchema: spec.fields,
    order: index,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

export function createEmptyDatabase(): AppDatabase {
  return {
    formatVersion: CURRENT_FORMAT_VERSION,
    sections: buildDefaultSections(),
    elements: [],
    variants: [],
    templates: [],
    cvProjects: [],
    cvVersions: [],
    trash: [],
    history: [],
    settings: { theme: "dark" },
  };
}

/**
 * Añade una sección custom nueva (§3 del contexto: "las secciones personalizadas
 * deben permitir definir sus propios campos"). Las secciones estándar también
 * pueden extenderse con `addFieldToSection`.
 */
export function addSectionDefinition(
  db: AppDatabase,
  params: { defaultTitle: string; fields: Array<Omit<FieldDefinition, "id">> }
): { db: AppDatabase; section: SectionDefinition } {
  const timestamp = nowIso();
  const section: SectionDefinition = {
    id: createId(),
    key: `custom-${createId()}`,
    isCustom: true,
    defaultTitle: params.defaultTitle,
    fieldSchema: params.fields.map((f) => ({ ...f, id: createId() })),
    order: db.sections.length,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return {
    db: { ...db, sections: [...db.sections, section] },
    section,
  };
}

/**
 * Añade un campo a una sección existente (estándar o custom) sin tocar los
 * datos ya guardados en los elementos que la usan (ARCHITECTURE.md §18-9).
 */
export function addFieldToSection(
  db: AppDatabase,
  sectionId: string,
  field: Omit<FieldDefinition, "id">
): AppDatabase {
  const timestamp = nowIso();
  const newField: FieldDefinition = { ...field, id: createId() };
  return {
    ...db,
    sections: db.sections.map((s) =>
      s.id === sectionId
        ? { ...s, fieldSchema: [...s.fieldSchema, newField], updatedAt: timestamp }
        : s
    ),
  };
}
