/**
 * Algunas fuentes incrustadas en PDFs (típicamente generados con LaTeX/
 * Overleaf) no traen un CMap ToUnicode correcto para ciertos glifos de
 * puntuación — pdf.js no puede traducirlos a su carácter Unicode real y
 * devuelve, en su lugar, un carácter de la Zona de Uso Privado de Unicode
 * (U+E000–U+F8FF), que no significa nada por sí mismo fuera de esa fuente
 * concreta.
 *
 * No hay forma de adivinar el significado de un carácter de Uso Privado en
 * general — dos PDFs distintos pueden reutilizar el MISMO código para dos
 * símbolos completamente distintos, según qué fuente incrusten. Esto es
 * simplemente una lista de sustituciones concretas, deducidas a mano por el
 * CONTEXTO en el que aparecían en CVs reales usados para probar esta
 * función (ver PROJECT_CONTEXT.md para el razonamiento completo de cada
 * una: p.ej. U+E09D aparecía siempre pegado a un número de teléfono o justo
 * después de "C" en "C++", nunca en otro contexto, de ahí "+").
 *
 * Los que NO están en esta lista se dejan tal cual — mejor un carácter
 * invisible puntual y detectable a simple vista (el usuario lo ve y lo
 * corrige a mano en la revisión) que arriesgarse a adivinar mal y generar
 * texto con un sentido distinto del original sin que se note. Si aparece un
 * PDF nuevo con glifos sin traducir, lo más sencillo es añadir aquí la
 * entrada que corresponda tras mirar el contexto de aparición.
 */
const KNOWN_GLYPH_FIXUPS: Record<string, string> = {
  "\uE049": "–", // guion largo (separador de rango de fechas)
  "\uE081": "(",
  "\uE082": ")",
  "\uE088": "-",
  "\uE089": "–",
  "\uE08C": "•",
  "\uE09D": "+",
};

export function fixKnownGlyphSubstitutions(text: string): string {
  let result = text;
  for (const [glyph, replacement] of Object.entries(KNOWN_GLYPH_FIXUPS)) {
    if (result.includes(glyph)) result = result.split(glyph).join(replacement);
  }
  return result;
}
