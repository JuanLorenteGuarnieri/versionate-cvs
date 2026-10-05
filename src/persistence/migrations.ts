import type { AppDatabase } from "../domain/model/types.js";
import { CURRENT_FORMAT_VERSION } from "../domain/model/types.js";
import { createId, nowIso } from "../domain/ids.js";
import { STANDARD_SECTION_KEY_ORDER } from "../domain/database.js";

/**
 * Error específico para datos inválidos/incompatibles, distinto de un bug de
 * programación (`Error` genérico). La UI puede capturarlo específicamente
 * para mostrar un mensaje claro en vez de un "algo ha ido mal" genérico.
 */
export class DatabaseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseValidationError";
  }
}

type RawDatabase = Record<string, unknown> & { formatVersion?: unknown };

/**
 * Migraciones registradas por versión DE ORIGEN. migrations[1] transforma
 * una AppDatabase de formatVersion 1 a formatVersion 2, etc.
 */
const migrations: Record<number, (raw: RawDatabase) => RawDatabase> = {
  // v1 -> v2: se añadieron nuevos parámetros de template (grosor de fuente,
  // mayúsculas de títulos, posición/formato de fecha, forma de viñeta,
  // apariencia de enlaces...) a petición del usuario. Los backups v1 no
  // tienen estas claves — `linkStyle` en concreto NO EXISTÍA como campo en
  // absoluto (a diferencia de sectionTitleStyle/headerStyle/etc, que ya
  // existían vacíos `{}`), así que sin esta migración `template.linkStyle`
  // sería `undefined` y cualquier lectura tipo `template.linkStyle.foo`
  // reventaría al cargar un backup real. Se comprobó importando un backup
  // real exportado por una sesión anterior de esta misma app.
  1: (raw) => {
    const templates = Array.isArray(raw.templates) ? raw.templates : [];
    const migratedTemplates = templates.map((t) => {
      if (typeof t !== "object" || t === null) return t;
      const template = t as Record<string, unknown>;
      const typography = (template.typography as Record<string, unknown> | undefined) ?? {};
      const spacing = (template.spacing as Record<string, unknown> | undefined) ?? {};
      return {
        ...template,
        typography: {
          fontWeight: 400,
          headingWeight: 700,
          headingCase: "uppercase",
          headingLetterSpacing: 0.4,
          textAlignment: "left",
          ...typography,
        },
        spacing: {
          paragraphSpacing: 4,
          ...spacing,
        },
        sectionTitleStyle: template.sectionTitleStyle ?? {},
        headerStyle: template.headerStyle ?? {},
        dateStyle: template.dateStyle ?? {},
        bulletStyle: template.bulletStyle ?? {},
        separators: template.separators ?? {},
        linkStyle: template.linkStyle ?? {},
      };
    });
    return { ...raw, formatVersion: 2, templates: migratedTemplates };
  },

  // v2 -> v3: "Links" de Datos personales y "URL" de Projects/Certifications/
  // Publications pasan de una URL suelta (tipo "list"/"url") a un tipo
  // "linklist" — nombre + URL por separado, para poder mostrar un texto
  // corto en vez de la URL completa (bug real reportado: sin esta
  // migración, las bases de datos YA EXISTENTES se quedaban con el tipo
  // antiguo para siempre, aunque las NUEVAS ya se creasen con "linklist" —
  // el cambio de schema por defecto en database.ts no alcanza a los datos
  // ya guardados). Los valores existentes (una URL suelta, o una lista de
  // URLs sueltas) se convierten a `{label: "", url}[]`, sin perder nada:
  // el nombre queda vacío (el renderer ya cae de vuelta al dominio de la
  // URL si no hay nombre, ver preview.ts) y el usuario puede rellenarlo.
  2: (raw) => {
    const LINK_FIELD_BY_SECTION_KEY: Record<string, string> = {
      "personal-information": "links",
      projects: "url",
      certifications: "url",
      publications: "url",
    };

    const sections = Array.isArray(raw.sections) ? raw.sections : [];
    const migratedSections = sections.map((s) => {
      if (typeof s !== "object" || s === null) return s;
      const section = s as Record<string, unknown>;
      const linkFieldKey = LINK_FIELD_BY_SECTION_KEY[section.key as string];
      if (!linkFieldKey || !Array.isArray(section.fieldSchema)) return section;
      const fieldSchema = (section.fieldSchema as Array<Record<string, unknown>>).map((f) =>
        f.key === linkFieldKey && (f.type === "list" || f.type === "url") ? { ...f, type: "linklist" } : f
      );
      return { ...section, fieldSchema };
    });

    const linkFieldBySectionId = new Map<string, string>();
    for (const s of migratedSections) {
      if (typeof s !== "object" || s === null) continue;
      const section = s as Record<string, unknown>;
      const fieldKey = LINK_FIELD_BY_SECTION_KEY[section.key as string];
      if (fieldKey) linkFieldBySectionId.set(section.id as string, fieldKey);
    }

    const elements = Array.isArray(raw.elements) ? raw.elements : [];
    const elementIdToLinkField = new Map<string, string>();
    for (const e of elements) {
      if (typeof e !== "object" || e === null) continue;
      const element = e as Record<string, unknown>;
      const fieldKey = linkFieldBySectionId.get(element.sectionId as string);
      if (fieldKey) elementIdToLinkField.set(element.id as string, fieldKey);
    }

    function toLinkListEntries(value: unknown): Array<{ label: string; url: string }> {
      if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === "object") {
          return value as Array<{ label: string; url: string }>; // ya migrado, no debería pasar
        }
        return (value as unknown[]).filter((v): v is string => typeof v === "string" && v.length > 0).map((url) => ({ label: "", url }));
      }
      if (typeof value === "string" && value.length > 0) return [{ label: "", url: value }];
      return [];
    }

    const variants = Array.isArray(raw.variants) ? raw.variants : [];
    const migratedVariants = variants.map((v) => {
      if (typeof v !== "object" || v === null) return v;
      const variant = v as Record<string, unknown>;
      const fieldKey = elementIdToLinkField.get(variant.elementId as string);
      const fields = variant.fields as Record<string, unknown> | undefined;
      if (!fieldKey || !fields || !(fieldKey in fields)) return variant;
      return { ...variant, fields: { ...fields, [fieldKey]: toLinkListEntries(fields[fieldKey]) } };
    });

    return { ...raw, formatVersion: 3, sections: migratedSections, variants: migratedVariants };
  },

  // v3 -> v4: Education gana un campo "location" (igual que Experience, que
  // ya lo tenía) para poder pintar la ubicación debajo de la fecha (mismo
  // sitio y mismo parámetro dateStyle.position que ya usan las fechas —
  // pedido explícito del usuario). Backfill del campo nuevo en el schema
  // de secciones "education" ya existentes, insertado justo después de
  // "institution" (mismo orden que en database.ts) y reordenando los
  // campos siguientes — los VALORES de los elementos ya creados no
  // necesitan tocarse, ya que simplemente no tendrán ese campo hasta que
  // el usuario lo rellene (ausente = "" al leerlo, como cualquier campo
  // opcional sin valor).
  3: (raw) => {
    const sections = Array.isArray(raw.sections) ? raw.sections : [];
    const migratedSections = sections.map((s) => {
      if (typeof s !== "object" || s === null) return s;
      const section = s as Record<string, unknown>;
      if (section.key !== "education" || !Array.isArray(section.fieldSchema)) return section;
      const fieldSchema = section.fieldSchema as Array<Record<string, unknown>>;
      if (fieldSchema.some((f) => f.key === "location")) return section; // ya migrada (no debería pasar, por si acaso)

      const institutionIndex = fieldSchema.findIndex((f) => f.key === "institution");
      const insertAt = institutionIndex === -1 ? fieldSchema.length : institutionIndex + 1;
      const locationField = { id: createId(), key: "location", label: "Location", type: "text", order: insertAt };
      const withLocation = [...fieldSchema.slice(0, insertAt), locationField, ...fieldSchema.slice(insertAt)];
      // Reordena "order" para que quede correlativo (0,1,2,3...) tras insertar en medio.
      const reordered = withLocation.map((f, i) => ({ ...f, order: i }));
      return { ...section, fieldSchema: reordered };
    });

    return { ...raw, formatVersion: 4, sections: migratedSections };
  },

  // v4 -> v5: la sección "profile" se renombra a "Summary" (petición
  // explícita del usuario) — la key interna sigue siendo "profile" (no se
  // toca ninguna referencia), solo cambia el título mostrado. Solo se
  // renombra si el usuario NO había personalizado ya el título (sigue
  // siendo literalmente "Profile"); si lo había cambiado a otra cosa, se
  // respeta su elección.
  4: (raw) => {
    const sections = Array.isArray(raw.sections) ? raw.sections : [];
    const migratedSections = sections.map((s) => {
      if (typeof s !== "object" || s === null) return s;
      const section = s as Record<string, unknown>;
      if (section.key === "profile" && section.defaultTitle === "Profile") {
        return { ...section, defaultTitle: "Summary" };
      }
      return section;
    });
    return { ...raw, formatVersion: 5, sections: migratedSections };
  },

  // v5 -> v6: fusión de "skills"/"programming-languages"/"software-tools"
  // en una única sección "skills" con 3 campos de listas de etiquetas
  // (petición explícita del usuario). Es la migración más "con pérdida" de
  // todas las hechas hasta ahora en este proyecto — se documenta con
  // detalle porque afecta a un modelo de datos real:
  //
  // - Las 3 secciones antiguas tenían UN ELEMENTO VERSIONABLE POR SKILL
  //   (con su propio "Nivel"). El nuevo modelo es "una sola lista de
  //   nombres" por campo — se pierde la posibilidad de versionar cada
  //   skill por separado y el campo "Nivel" (no tiene equivalente en el
  //   nuevo schema).
  // - Los elementos/variantes ORIGINALES no se borran: se mueven a la
  //   papelera (recuperables desde ahí, igual que cualquier otro borrado
  //   de esta app — nunca se pierde nada de forma irreversible).
  // - Mapeo de sección origen -> campo nuevo:
  //     "programming-languages" -> programmingLanguages (mapeo claro)
  //     "software-tools"        -> technologies (mapeo claro)
  //     "skills" (genérica)     -> softSkills (la antigua sección "skills"
  //       era un cajón genérico sin distinción semántica — de las 3
  //       categorías nuevas, "Soft Skills" es la que mejor encaja como
  //       cajón por defecto, pero es una decisión editorial, no una
  //       traducción exacta; el usuario puede recolocar manualmente
  //       cualquier valor tras la migración).
  // - Si el usuario tenía contenido de estas secciones seleccionado en
  //   algún CV concreto, esa CV recibe un único item nuevo apuntando al
  //   elemento fusionado, en la posición de la más temprana de las 3
  //   secciones antiguas, para no perder visibilidad de golpe (§8: las
  //   secciones vacías no se muestran, pero esta no lo estaba).
  5: (raw) => {
    const OLD_KEYS = ["skills", "programming-languages", "software-tools"] as const;
    const FIELD_BY_OLD_KEY: Record<(typeof OLD_KEYS)[number], "programmingLanguages" | "technologies" | "softSkills"> = {
      "programming-languages": "programmingLanguages",
      "software-tools": "technologies",
      skills: "softSkills",
    };

    const sections = Array.isArray(raw.sections) ? raw.sections : [];
    const oldSectionById = new Map<string, string>(); // sectionId -> old key
    let skillsSectionId: string | null = null;
    for (const s of sections) {
      if (typeof s !== "object" || s === null) continue;
      const section = s as Record<string, unknown>;
      if (OLD_KEYS.includes(section.key as (typeof OLD_KEYS)[number])) {
        oldSectionById.set(section.id as string, section.key as string);
      }
      if (section.key === "skills") skillsSectionId = section.id as string;
    }

    // Si no hay ninguna sección "skills" en absoluto (base de datos muy
    // antigua/anómala), no hay nada que fusionar de forma segura: se deja
    // la base de datos intacta salvo por el número de versión.
    if (!skillsSectionId) return { ...raw, formatVersion: 6 };

    const elements = Array.isArray(raw.elements) ? raw.elements : [];
    const variants = Array.isArray(raw.variants) ? raw.variants : [];

    const namesByField: Record<"programmingLanguages" | "technologies" | "softSkills", string[]> = {
      programmingLanguages: [],
      technologies: [],
      softSkills: [],
    };
    const oldElementIds = new Set<string>();
    const oldVariantIds = new Set<string>();
    const trashedElementEntries: Array<Record<string, unknown>> = [];

    for (const e of elements) {
      if (typeof e !== "object" || e === null) continue;
      const element = e as Record<string, unknown>;
      const oldKey = oldSectionById.get(element.sectionId as string);
      if (!oldKey) continue;
      oldElementIds.add(element.id as string);

      const ownVariants = variants.filter(
        (v) => typeof v === "object" && v !== null && (v as Record<string, unknown>).elementId === element.id
      );
      for (const v of ownVariants) oldVariantIds.add((v as Record<string, unknown>).id as string);

      const defaultVariant = ownVariants.find(
        (v) => (v as Record<string, unknown>).id === element.defaultVariantId
      ) as Record<string, unknown> | undefined;
      const fields = defaultVariant?.fields as Record<string, unknown> | undefined;
      const name = fields?.name;
      if (typeof name === "string" && name.trim().length > 0) {
        namesByField[FIELD_BY_OLD_KEY[oldKey as (typeof OLD_KEYS)[number]]].push(name.trim());
      }

      trashedElementEntries.push({
        id: createId(),
        entityType: "element",
        entityId: element.id,
        snapshot: { element, variants: ownVariants },
        deletedAt: nowIso(),
      });
    }

    const hasAnyContent =
      namesByField.programmingLanguages.length > 0 ||
      namesByField.technologies.length > 0 ||
      namesByField.softSkills.length > 0;

    // Nueva SectionDefinition "skills": mismo id, nuevo fieldSchema de 3
    // campos de etiquetas (ver database.ts, mismo orden/labels/keys).
    const migratedSections = sections
      .filter((s) => {
        if (typeof s !== "object" || s === null) return true;
        const section = s as Record<string, unknown>;
        // Las otras 2 secciones antiguas desaparecen; "skills" se conserva
        // (se transforma justo debajo).
        return !(section.key === "programming-languages" || section.key === "software-tools");
      })
      .map((s) => {
        if (typeof s !== "object" || s === null) return s;
        const section = s as Record<string, unknown>;
        if (section.id !== skillsSectionId) return section;
        return {
          ...section,
          fieldSchema: [
            { id: createId(), key: "programmingLanguages", label: "Programming Languages", type: "tags", order: 0 },
            { id: createId(), key: "technologies", label: "Technologies", type: "tags", order: 1 },
            { id: createId(), key: "softSkills", label: "Soft Skills", type: "tags", order: 2 },
          ],
        };
      });

    let mergedElementId: string | null = null;
    let mergedVariantId: string | null = null;
    let migratedElements = elements.filter(
      (e) => typeof e !== "object" || e === null || !oldElementIds.has((e as Record<string, unknown>).id as string)
    );
    let migratedVariants = variants.filter(
      (v) => typeof v !== "object" || v === null || !oldVariantIds.has((v as Record<string, unknown>).id as string)
    );

    if (hasAnyContent) {
      mergedElementId = createId();
      mergedVariantId = createId();
      const now = nowIso();
      migratedVariants = [
        ...migratedVariants,
        {
          id: mergedVariantId,
          elementId: mergedElementId,
          name: "Fusión automática (migración)",
          derivedFromVariantId: null,
          fields: {
            programmingLanguages: namesByField.programmingLanguages,
            technologies: namesByField.technologies,
            softSkills: namesByField.softSkills,
          },
          createdAt: now,
          updatedAt: now,
        },
      ];
      migratedElements = [
        ...migratedElements,
        {
          id: mergedElementId,
          sectionId: skillsSectionId,
          variantIds: [mergedVariantId],
          defaultVariantId: mergedVariantId,
          createdAt: now,
          updatedAt: now,
        },
      ];
    }

    // CVVersions: quita cualquier item que apuntara a un elemento ahora
    // trasladado a la papelera, y colapsa las 3 instancias de sección en
    // una — con un item para el elemento fusionado SOLO si esa CV en
    // concreto tenía contenido visible en alguna de las 3 (para no hacer
    // aparecer la sección en CVs donde nunca estuvo).
    const cvVersions = Array.isArray(raw.cvVersions) ? raw.cvVersions : [];
    const migratedCvVersions = cvVersions.map((v) => {
      if (typeof v !== "object" || v === null) return v;
      const version = v as Record<string, unknown>;
      const versionSections = Array.isArray(version.sections) ? version.sections : [];
      const oldInstances = versionSections.filter(
        (s) =>
          typeof s === "object" &&
          s !== null &&
          oldSectionById.has((s as Record<string, unknown>).sectionDefinitionId as string)
      ) as Array<Record<string, unknown>>;
      if (oldInstances.length === 0) return version;

      const hadVisibleContent = oldInstances.some(
        (s) => Array.isArray(s.items) && (s.items as unknown[]).length > 0
      );
      const earliestOrder = Math.min(...oldInstances.map((s) => (s.order as number) ?? 0));

      const rest = versionSections.filter(
        (s) =>
          !(
            typeof s === "object" &&
            s !== null &&
            oldSectionById.has((s as Record<string, unknown>).sectionDefinitionId as string)
          )
      );
      const newSkillsInstance = {
        sectionDefinitionId: skillsSectionId,
        order: earliestOrder,
        items: hadVisibleContent && mergedElementId && mergedVariantId
          ? [{ elementId: mergedElementId, variantId: mergedVariantId, order: 0 }]
          : [],
      };
      return { ...version, sections: [...rest, newSkillsInstance] };
    });

    const trash = Array.isArray(raw.trash) ? raw.trash : [];

    return {
      ...raw,
      formatVersion: 6,
      sections: migratedSections,
      elements: migratedElements,
      variants: migratedVariants,
      cvVersions: migratedCvVersions,
      trash: [...trash, ...trashedElementEntries],
    };
  },

  // v6 -> v7: "Projects" pierde su campo de fecha (petición explícita: los
  // proyectos no tienen por qué tener fecha) y gana un campo "subtitle"
  // (petición explícita, para el layout título/subtítulo+enlaces/
  // descripción/tecnologías — ver preview.ts:buildProjectLayout). El campo
  // de fecha NO se borra de los datos ya guardados (los valores existentes
  // se quedan huérfanos en el JSON, inertes, igual que ya se documentó para
  // el borrado de campos de schema) — recuperable manualmente del JSON
  // exportado si hiciera falta, aunque ya no se muestra en ningún sitio.
  6: (raw) => {
    const sections = Array.isArray(raw.sections) ? raw.sections : [];
    const migratedSections = sections.map((s) => {
      if (typeof s !== "object" || s === null) return s;
      const section = s as Record<string, unknown>;
      if (section.key !== "projects" || !Array.isArray(section.fieldSchema)) return section;
      const fieldSchema = section.fieldSchema as Array<Record<string, unknown>>;
      const withoutDate = fieldSchema.filter((f) => f.key !== "dateRange");
      if (withoutDate.some((f) => f.key === "subtitle")) {
        return { ...section, fieldSchema: withoutDate.map((f, i) => ({ ...f, order: i })) };
      }
      const titleIndex = withoutDate.findIndex((f) => f.key === "title");
      const insertAt = titleIndex === -1 ? 0 : titleIndex + 1;
      const subtitleField = { id: createId(), key: "subtitle", label: "Subtitle", type: "text", order: insertAt };
      const withSubtitle = [...withoutDate.slice(0, insertAt), subtitleField, ...withoutDate.slice(insertAt)];
      const reordered = withSubtitle.map((f, i) => ({ ...f, order: i }));
      return { ...section, fieldSchema: reordered };
    });

    return { ...raw, formatVersion: 7, sections: migratedSections };
  },

  // v7 -> v8: nuevo parámetro de template `languagesStyle` (petición
  // explícita: alineación + modo — fila/columnas/lista — configurables para
  // la sección "Languages"). Bag nuevo a nivel de template (no una clave
  // dentro de un bag ya existente), así que sí hace falta backfill explícito
  // — si no, `template.languagesStyle` sería `undefined` y el renderer
  // reventaría al leer `.alignment`/`.mode` (mismo motivo que la migración
  // v1->v2 con los bags de esa sesión).
  7: (raw) => {
    const templates = Array.isArray(raw.templates) ? raw.templates : [];
    const migratedTemplates = templates.map((t) => {
      if (typeof t !== "object" || t === null) return t;
      const template = t as Record<string, unknown>;
      if (template.languagesStyle && typeof template.languagesStyle === "object") return template;
      return { ...template, languagesStyle: { alignment: "center", mode: "columns" } };
    });
    return { ...raw, formatVersion: 8, templates: migratedTemplates };
  },

  // v8 -> v9: "Skills" pasa a ir justo después de "Summary" y antes de
  // "Experience" (petición explícita del usuario — antes iba justo después
  // de "Projects", casi al final de la lista). El `order` de una
  // SectionDefinition no controla el orden dentro de un CV ya creado (eso
  // lo decide cada CVVersion por separado, reordenable a mano — se
  // respeta tal cual, un CV existente no cambia de orden solo), pero SÍ
  // controla: el orden en que se listan las secciones en el Dashboard, el
  // orden en que se ofrecen para añadir en el editor de CV, y el orden en
  // que "Crear CV a partir de una oferta" (jobMatching.ts) añade cada
  // sección a un CV NUEVO (que sí hereda este orden, al ir añadiendo
  // secciones una a una en el orden de `db.sections`). Recalcula el
  // `order` de las secciones ESTÁNDAR según `STANDARD_SECTION_KEY_ORDER`
  // (única fuente de verdad, compartida con database.ts); las secciones
  // CUSTOM del usuario conservan su orden relativo entre sí, desplazadas
  // después de todas las estándar (antes solían intercalarse según cuándo
  // se hubieran creado).
  8: (raw) => {
    const sections = Array.isArray(raw.sections) ? raw.sections : [];
    const isStandardKey = (key: unknown): boolean =>
      typeof key === "string" && (STANDARD_SECTION_KEY_ORDER as readonly string[]).includes(key);

    const customSectionsByOldOrder = sections
      .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null && !isStandardKey((s as Record<string, unknown>).key))
      .sort((a, b) => ((a.order as number) ?? 0) - ((b.order as number) ?? 0));

    const newOrderByCustomId = new Map<string, number>();
    customSectionsByOldOrder.forEach((s, i) => {
      newOrderByCustomId.set(s.id as string, STANDARD_SECTION_KEY_ORDER.length + i);
    });

    const migratedSections = sections.map((s) => {
      if (typeof s !== "object" || s === null) return s;
      const section = s as Record<string, unknown>;
      if (isStandardKey(section.key)) {
        return { ...section, order: (STANDARD_SECTION_KEY_ORDER as readonly string[]).indexOf(section.key as string) };
      }
      const customOrder = newOrderByCustomId.get(section.id as string);
      return customOrder === undefined ? section : { ...section, order: customOrder };
    });

    return { ...raw, formatVersion: 9, sections: migratedSections };
  },
};

const REQUIRED_ARRAY_FIELDS = [
  "sections",
  "elements",
  "variants",
  "templates",
  "cvProjects",
  "cvVersions",
  "trash",
  "history",
] as const;

function validateShape(raw: RawDatabase): void {
  for (const key of REQUIRED_ARRAY_FIELDS) {
    if (!Array.isArray(raw[key])) {
      throw new DatabaseValidationError(
        `El archivo no es una base de datos válida: falta o es inválido el campo "${key}".`
      );
    }
  }
  if (typeof raw.settings !== "object" || raw.settings === null) {
    throw new DatabaseValidationError('El archivo no es una base de datos válida: falta "settings".');
  }
}

/**
 * Convierte cualquier valor ya parseado (de JSON.parse o de IndexedDB) en una
 * AppDatabase válida en el formato actual, aplicando migraciones si hace
 * falta. Lanza `DatabaseValidationError` con un mensaje entendible por un
 * humano si el contenido no es reconocible — nunca falla en silencio ni
 * devuelve una base de datos a medias.
 */
export function migrateRawDatabase(raw: unknown): AppDatabase {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new DatabaseValidationError("El contenido no es un objeto JSON de base de datos válido.");
  }

  let current = raw as RawDatabase;

  if (typeof current.formatVersion !== "number") {
    throw new DatabaseValidationError('Falta el campo "formatVersion" en la base de datos.');
  }
  if (current.formatVersion > CURRENT_FORMAT_VERSION) {
    throw new DatabaseValidationError(
      `Esta base de datos es de una versión más nueva (formatVersion ${current.formatVersion}) que la que ` +
        `soporta esta versión de la aplicación (${CURRENT_FORMAT_VERSION}). Actualiza la aplicación antes de importarla.`
    );
  }

  while ((current.formatVersion as number) < CURRENT_FORMAT_VERSION) {
    const step = migrations[current.formatVersion as number];
    if (!step) {
      throw new DatabaseValidationError(
        `No existe una ruta de migración desde formatVersion ${current.formatVersion} hasta ${CURRENT_FORMAT_VERSION}.`
      );
    }
    current = step(current);
  }

  validateShape(current);
  return current as unknown as AppDatabase;
}
