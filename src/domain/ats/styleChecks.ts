export interface ContrastCheckResult {
  ratio: number;
  /** Cumple WCAG AA para texto normal (ratio >= 4.5). */
  passesAA: boolean;
  /** Cumple WCAG AA para texto grande (ratio >= 3), un umbral más permisivo. */
  passesAALarge: boolean;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3 ? normalized.split("").map((c) => c + c).join("") : normalized;
  const value = parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calcula el ratio de contraste WCAG entre el color de texto y de fondo de
 * una template (§20 del contexto). Fórmula estándar del W3C, sin ninguna
 * dependencia externa.
 */
export function checkContrast(textColor: string, backgroundColor: string): ContrastCheckResult {
  const l1 = relativeLuminance(hexToRgb(textColor));
  const l2 = relativeLuminance(hexToRgb(backgroundColor));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (lighter + 0.05) / (darker + 0.05);

  return {
    ratio: Math.round(ratio * 100) / 100,
    passesAA: ratio >= 4.5,
    passesAALarge: ratio >= 3,
  };
}

export interface FontSizeCheckResult {
  tooSmall: boolean;
  recommendation: string | null;
}

/** Umbral en puntos por debajo del cual el texto puede resultar difícil de leer. */
const MIN_RECOMMENDED_FONT_SIZE = 9;

export function checkFontSize(baseFontSize: number): FontSizeCheckResult {
  if (baseFontSize < MIN_RECOMMENDED_FONT_SIZE) {
    return {
      tooSmall: true,
      recommendation:
        `El tamaño de letra del cuerpo (${baseFontSize}pt) es menor de ${MIN_RECOMMENDED_FONT_SIZE}pt: ` +
        "puede resultar difícil de leer, tanto para personas como para algunos sistemas ATS.",
    };
  }
  return { tooSmall: false, recommendation: null };
}

export interface ColumnLayoutRisk {
  atRisk: boolean;
  message: string;
}

/**
 * Petición: "detección de tablas/columnas múltiples: muchos ATS reales no
 * leen bien layouts en 2 columnas". La app en sí NO admite layouts de CV
 * multi-columna (§10/§27 del contexto: no-goal explícito) — con una
 * excepción real: la sección "Languages" puede configurarse en modo
 * "columns" (§29, sesión 9), que sí reparte contenido en columnas dentro
 * de esa sección. Este chequeo se centra en ESA situación concreta, que es
 * la única forma real en la que puede darse el riesgo que describe la
 * mejora sugerida dentro de esta app — no es una detección geométrica
 * genérica (para eso haría falta medir el layout ya renderizado, que el
 * dominio no puede hacer sin acceso al DOM).
 */
export function checkColumnLayoutRisk(languagesMode: string | undefined, languageItemCount: number): ColumnLayoutRisk {
  if (languagesMode === "columns" && languageItemCount >= 2) {
    return {
      atRisk: true,
      message:
        "La sección Languages está configurada en modo 'Columnas'. Algunos sistemas ATS no leen bien el contenido " +
        "dispuesto en columnas y pueden mezclar el orden de los idiomas/niveles. Si vas a subir este CV a un portal " +
        "ATS, considera cambiar el modo a 'Fila' o 'Lista' en los parámetros de la template.",
    };
  }
  return { atRisk: false, message: "No se ha detectado contenido dispuesto en columnas." };
}

export interface IconRisk {
  atRisk: boolean;
  message: string;
}

/**
 * Petición: "detección de iconos/gráficos usados como portadores de
 * información (p.ej. un icono de teléfono sin el texto 'Teléfono' al
 * lado)". El modelo de datos de esta app no tiene ningún tipo de campo
 * para imágenes ni iconos (ver la nota en model/types.ts: "no existe
 * FieldType 'image'") y el renderer (CVPreview.tsx) no pinta ningún icono
 * ni gráfico en el documento — así que este riesgo es estructuralmente
 * imposible en un CV generado por esta app hoy. Se deja implementado (en
 * vez de omitirlo) por completitud del informe y porque, si en el futuro
 * se añadiera soporte de foto de perfil o iconos de contacto, este es el
 * sitio donde debería empezar a analizarse de verdad.
 */
export function checkIconRisk(): IconRisk {
  return {
    atRisk: false,
    message:
      "Esta app no admite iconos ni imágenes como portadores de información en el CV — no hay nada que revisar aquí.",
  };
}
