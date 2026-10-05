/**
 * Diccionario léxico de cabeceras de sección, en inglés y español (§8.1
 * del informe de importación de PDF): equivalencias ortográficas, formas
 * alternativas y expresiones frecuentes. Vive aparte de segmentation.ts
 * para poder ampliarlo sin tocar la lógica de coincidencia — añadir un
 * sinónimo nuevo es simplemente añadir una cadena más a la lista.
 *
 * Coincidencia por prefijo (ver segmentation.ts:normalize/detectHeadings):
 * "experience" también coincide con "experience:" o "experience section".
 */
export const SECTION_KEYWORDS: Record<string, string[]> = {
  "personal-information": [
    "contact",
    "contacto",
    "personal information",
    "informacion personal",
    "datos personales",
    "datos de contacto",
  ],
  profile: [
    "profile",
    "summary",
    "about me",
    "perfil",
    "resumen",
    "sobre mi",
    "acerca de mi",
    "professional summary",
    "resumen profesional",
    "objective",
    "objetivo profesional",
  ],
  experience: [
    "experience",
    "work experience",
    "professional experience",
    "experiencia",
    "experiencia laboral",
    "employment",
    "employment history",
    "work history",
    "career history",
    "empleo",
    "historial laboral",
    "trayectoria profesional",
  ],
  education: [
    "education",
    "educacion",
    "formacion",
    "formacion academica",
    "academic background",
    "formacion academica y titulos",
  ],
  projects: ["projects", "proyectos", "personal projects", "proyectos personales", "portfolio", "portafolio"],
  // "Programming languages"/"Software tools" apuntan ahora a la sección
  // fusionada "skills" (ver database.ts) — ya no existen como secciones
  // propias. La extracción campo-a-campo específica de esta sección no está
  // implementada (limitación conocida, ver PROJECT_CONTEXT.md): el usuario
  // puede seguir revisando/rellenando manualmente en la pantalla de
  // importación, igual que con cualquier otra sección sin heurística propia.
  skills: [
    "skills",
    "habilidades",
    "competencias",
    "programming languages",
    "lenguajes de programacion",
    "software tools",
    "herramientas de software",
    "programas",
    "herramientas",
    "technical skills",
    "habilidades tecnicas",
    "tech stack",
  ],
  languages: ["languages", "idiomas"],
  certifications: ["certifications", "certificaciones", "certificates", "licenses and certifications"],
  awards: ["awards", "premios", "reconocimientos", "honors and awards"],
  publications: ["publications", "publicaciones"],
  courses: ["courses", "cursos"],
  volunteering: ["volunteering", "voluntariado", "volunteer experience"],
  references: ["references", "referencias", "referees"],
};
