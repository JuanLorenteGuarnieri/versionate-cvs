/**
 * Traducción de la interfaz "de fábrica" del CV (títulos de sección y
 * etiquetas de campo TAL COMO están en database.ts, en inglés) a otros
 * idiomas, más el idioma de las fechas — controlado por un campo del CV
 * (CVVersion.displayLanguage), no de la template.
 *
 * IMPORTANTE — qué es esto y qué NO es (§21 del contexto: "No habrá
 * traducción automática... no se debe implementar un servicio externo de
 * traducción"):
 *
 * - Esto es un diccionario ESTÁTICO y LOCAL de un puñado de textos fijos
 *   que la propia app pone por defecto (títulos de sección, etiquetas de
 *   campo como "Location" o "Level") — no un traductor. No hay ninguna
 *   llamada externa ni modelo de lenguaje de por medio.
 * - SOLO traduce texto que coincide EXACTAMENTE con uno de estos valores
 *   por defecto. En cuanto el usuario edita un título de sección o el
 *   contenido de un campo, deja de coincidir con la clave del diccionario
 *   y se queda tal cual el usuario lo escribió — nunca se traduce
 *   contenido propio del usuario (descripciones, nombres de proyectos,
 *   etc.), solo esta "cascarilla" que la app genera.
 * - Si se quiere el CV en un idioma no soportado aquí, la vía que ya
 *   existía sigue abierta: renombrar secciones/campos a mano (§21: "el
 *   usuario debe poder modificarlos").
 */

/** Mapeo del código corto de idioma guardado en el CV a un locale BCP-47 usable por Intl. */
const LOCALE_BY_LANGUAGE: Record<string, string> = {
  es: "es-ES",
  en: "en-US",
  fr: "fr-FR",
  de: "de-DE",
  pt: "pt-PT",
  it: "it-IT",
};

export const SUPPORTED_DISPLAY_LANGUAGES = Object.keys(LOCALE_BY_LANGUAGE);

/** BCP-47 para Intl/toLocaleDateString, a partir del código corto guardado en el CV. */
export function localeForDisplayLanguage(lang: string | null | undefined): string {
  if (!lang) return LOCALE_BY_LANGUAGE.en!;
  return LOCALE_BY_LANGUAGE[lang] ?? LOCALE_BY_LANGUAGE.en!;
}

/** "Actualidad"/"Present"/... para DateRangeValue.current — ver formatting.ts. */
const CURRENT_LABEL_BY_LANGUAGE: Record<string, string> = {
  es: "Actualidad",
  en: "Present",
  fr: "Aujourd'hui",
  de: "Heute",
  pt: "Atualidade",
  it: "Presente",
};

export function currentLabelForDisplayLanguage(lang: string | null | undefined): string {
  if (!lang) return CURRENT_LABEL_BY_LANGUAGE.en!;
  return CURRENT_LABEL_BY_LANGUAGE[lang] ?? CURRENT_LABEL_BY_LANGUAGE.en!;
}

/**
 * Diccionario texto-por-defecto -> traducción, por idioma. El inglés es la
 * base (lo que ya hay en database.ts) así que no necesita entrada propia:
 * elegir "en" es un no-op.
 */
const LABEL_TRANSLATIONS: Record<string, Record<string, string>> = {
  es: {
    // Títulos de sección
    "Personal information": "Información personal",
    Experience: "Experiencia",
    Education: "Educación",
    Projects: "Proyectos",
    Skills: "Habilidades",
    Languages: "Idiomas",
    Certifications: "Certificaciones",
    Awards: "Premios",
    Publications: "Publicaciones",
    Courses: "Cursos",
    Volunteering: "Voluntariado",
    References: "Referencias",
    // Etiquetas de campo
    "Full name": "Nombre completo",
    "Headline / role": "Titular / puesto",
    Email: "Correo electrónico",
    Phone: "Teléfono",
    Location: "Ubicación",
    "Links (portfolio, GitHub, LinkedIn...)": "Enlaces (portfolio, GitHub, LinkedIn...)",
    Links: "Enlaces",
    Summary: "Resumen",
    Role: "Puesto",
    Company: "Empresa",
    Dates: "Fechas",
    Description: "Descripción",
    Technologies: "Tecnologías",
    Degree: "Titulación",
    Institution: "Institución",
    Title: "Título",
    Subtitle: "Subtítulo",
    Skill: "Habilidad",
    Level: "Nivel",
    Language: "Idioma",
    Tool: "Herramienta",
    "Programming Languages": "Lenguajes de programación",
    "Soft Skills": "Habilidades blandas",
    Name: "Nombre",
    Issuer: "Emisor",
    Date: "Fecha",
    Venue: "Publicado en",
    Organization: "Organización",
    Relation: "Relación",
    Contact: "Contacto",
  },
};

/**
 * Traduce un texto (título de sección o etiqueta de campo) si coincide
 * EXACTAMENTE con uno de los valores por defecto conocidos para ese
 * idioma; si no coincide (texto personalizado por el usuario, o idioma sin
 * diccionario), lo devuelve tal cual, sin tocarlo.
 */
export function translateDefaultLabel(text: string, lang: string | null | undefined): string {
  if (!lang) return text;
  const dict = LABEL_TRANSLATIONS[lang];
  if (!dict) return text;
  return dict[text] ?? text;
}
