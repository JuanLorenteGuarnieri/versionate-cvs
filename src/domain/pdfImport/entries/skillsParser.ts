import type { FieldValue, SectionDefinition } from "../../model/types.js";

/**
 * La sección "Skills" no es una lista de entradas repetidas como Experience
 * — es un único conjunto de listas de etiquetas (§15.1 del informe:
 * "Skills / Programming Languages / Software Tools" son casos con
 * transformación propia, no genérica). Esta función recibe TODO el texto
 * en bruto de la sección (todas las líneas, antes de trocear en entradas)
 * y reparte cada tecnología/habilidad mencionada en el bucket que le
 * corresponda.
 *
 * Estrategia en dos niveles, de más a menos fiable:
 *   1. Líneas con etiqueta explícita ("Programming Languages: Python,
 *      Java" / "Tools: Docker, Git" / "Soft Skills: Leadership") — la
 *      señal más fuerte posible, se usa siempre que aparece.
 *   2. Para el resto (una lista suelta de tokens sin etiqueta, un caso muy
 *      común: cada skill en su propia línea o separados por comas), un
 *      pequeño diccionario cerrado de lenguajes de programación y de
 *      soft-skills frecuentes clasifica cada token; lo que no reconoce
 *      ninguno de los dos diccionarios cae en "technologies" en vez de
 *      descartarse — más seguro asumir "herramienta que no conozco" que
 *      perder el dato (Apéndice B del informe: nunca tirar texto).
 */

const LABEL_PATTERNS: { key: "programmingLanguages" | "technologies" | "softSkills"; synonyms: string[] }[] = [
  {
    key: "programmingLanguages",
    synonyms: ["programming languages", "lenguajes de programacion", "languages", "lenguajes"],
  },
  {
    key: "technologies",
    synonyms: [
      "technologies",
      "tools",
      "software",
      "tecnologias",
      "herramientas",
      "tech stack",
      "frameworks",
      "programas",
    ],
  },
  {
    key: "softSkills",
    synonyms: ["soft skills", "habilidades blandas", "competencias", "personal skills", "habilidades personales"],
  },
];

const KNOWN_PROGRAMMING_LANGUAGES = new Set(
  [
    "python",
    "java",
    "javascript",
    "typescript",
    "c",
    "c++",
    "c#",
    "go",
    "golang",
    "rust",
    "ruby",
    "php",
    "swift",
    "kotlin",
    "sql",
    "html",
    "css",
    "scala",
    "r",
    "matlab",
    "perl",
    "bash",
    "shell",
    "dart",
    "objective-c",
    "haskell",
    "lua",
  ].map((s) => s.toLowerCase())
);

const KNOWN_SOFT_SKILLS = new Set(
  [
    "leadership",
    "communication",
    "teamwork",
    "problem solving",
    "adaptability",
    "creativity",
    "time management",
    "critical thinking",
    "collaboration",
    "liderazgo",
    "comunicacion",
    "trabajo en equipo",
    "resolucion de problemas",
    "adaptabilidad",
    "creatividad",
    "gestion del tiempo",
    "pensamiento critico",
    "colaboracion",
  ].map((s) => s.toLowerCase())
);

function normalizeKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function splitTokens(value: string): string[] {
  return value
    .split(/[,•|;/]|(?:\s{2,})/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function matchLabel(rawLabel: string): "programmingLanguages" | "technologies" | "softSkills" | null {
  const normalized = normalizeKey(rawLabel);
  for (const { key, synonyms } of LABEL_PATTERNS) {
    if (synonyms.some((s) => normalized === s || normalized.startsWith(s))) return key;
  }
  return null;
}

function classifyToken(token: string): "programmingLanguages" | "softSkills" | "technologies" {
  const normalized = normalizeKey(token);
  if (KNOWN_PROGRAMMING_LANGUAGES.has(normalized)) return "programmingLanguages";
  if (KNOWN_SOFT_SKILLS.has(normalized)) return "softSkills";
  return "technologies";
}

export function extractSkillsFields(rawLines: string[], section: SectionDefinition): Record<string, FieldValue> {
  const buckets: Record<"programmingLanguages" | "technologies" | "softSkills", string[]> = {
    programmingLanguages: [],
    technologies: [],
    softSkills: [],
  };

  for (const line of rawLines) {
    const labelMatch = line.match(/^([^:]{2,40}):\s*(.+)$/);
    if (labelMatch) {
      const bucket = matchLabel(labelMatch[1]!);
      if (bucket) {
        buckets[bucket].push(...splitTokens(labelMatch[2]!));
        continue;
      }
    }
    // Sin etiqueta reconocida: reparte cada token de la línea por diccionario.
    for (const token of splitTokens(line)) {
      buckets[classifyToken(token)].push(token);
    }
  }

  // Deduplica conservando el primer casing visto de cada token.
  const dedupe = (values: string[]): string[] => {
    const seen = new Map<string, string>();
    for (const v of values) {
      const key = normalizeKey(v);
      if (key && !seen.has(key)) seen.set(key, v);
    }
    return [...seen.values()];
  };

  const orderedSchema = [...section.fieldSchema].sort((a, b) => a.order - b.order);
  const tagFields = orderedSchema.filter((f) => f.type === "tags");

  const fields: Record<string, FieldValue> = {};
  if (tagFields.length === 0) return fields;

  // Busca, para cada bucket, el campo cuyo key/label hable de ese concepto;
  // si la sección solo tiene UN campo de tags (custom section simple), todo
  // va junto ahí, sin perder ningún dato.
  const findField = (needle: string[]) =>
    tagFields.find((f) => needle.some((n) => normalizeKey(f.key).includes(n) || normalizeKey(f.label).includes(n)));

  const progField = findField(["programming", "lenguaje de programacion", "lenguajes"]) ?? tagFields[0]!;
  const techField = findField(["technolog", "tool", "software", "tecnolog", "herramient"]) ?? tagFields[0]!;
  const softField = findField(["soft", "personal skill", "habilidad blanda", "competenc"]) ?? tagFields[0]!;

  const mergeInto = (fieldKey: string, values: string[]) => {
    if (values.length === 0) return;
    const existing = (fields[fieldKey] as string[] | undefined) ?? [];
    fields[fieldKey] = dedupe([...existing, ...values]);
  };

  mergeInto(progField.key, buckets.programmingLanguages);
  mergeInto(techField.key, buckets.technologies);
  mergeInto(softField.key, buckets.softSkills);

  return fields;
}
