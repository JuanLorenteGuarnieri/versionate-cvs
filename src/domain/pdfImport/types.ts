/** Un fragmento de texto extraído de un PDF, con su posición y estilo. */
export interface ExtractedTextItem {
  text: string;
  /** Posición en puntos PDF (1pt = 1/72 in), origen abajo-izquierda de la página. */
  x: number;
  y: number;
  /** Tamaño de fuente en puntos, derivado de la matriz de transformación del texto. */
  fontSize: number;
  fontName: string;
  /** Página de origen, 1-indexada. */
  page: number;
  /**
   * Ancho del item en puntos PDF, tal y como lo da `TextItem.width` de
   * pdf.js. Opcional (no todos los llamadores/tests lo rellenan) para no
   * romper fixtures existentes — cuando falta, el código que lo usa cae de
   * vuelta a una estimación por longitud de texto (ver styleAnalysis.ts).
   * Con este dato ya no hace falta adivinar el ancho del margen derecho.
   */
  width?: number;
  /**
   * Heurística best-effort a partir del nombre interno de la fuente
   * embebida (p.ej. "...-Bold", "...-Italic"). No es fiable al 100% — pdf.js
   * no expone el peso/estilo real de forma estructurada vía
   * `getTextContent()` — pero es la única señal disponible sin inspeccionar
   * operadores de render, y basta para distinguir títulos de sección de
   * cuerpo en la inmensa mayoría de CVs reales.
   */
  bold?: boolean;
  italic?: boolean;
}

/** Un enlace vivo (anotación) de una página del PDF, con su caja en las
 * mismas coordenadas que `ExtractedTextItem` (puntos PDF, origen abajo-
 * izquierda). Permite recuperar la URL real de un texto tipo "LinkedIn"
 * cuando el propio texto visible no tiene pinta de URL — ver
 * fields/linkExtraction.ts. */
export interface ExtractedLinkAnnotation {
  url: string;
  page: number;
  /** [x1, y1, x2, y2], esquina inferior-izquierda y superior-derecha. */
  rect: [number, number, number, number];
}

export interface ExtractedPdfDocument {
  /** Ancho/alto de página en puntos PDF (se asume la misma para todas las páginas). */
  pageWidth: number;
  pageHeight: number;
  numPages: number;
  /** Todos los items de texto de todas las páginas, en el orden en que pdf.js los devuelve. */
  items: ExtractedTextItem[];
  /**
   * Anotaciones de tipo enlace de todas las páginas. Vacío si el PDF no
   * tiene ninguna. Opcional para no obligar a todos los fixtures de test
   * existentes (construidos a mano, sin PDF real de por medio) a rellenar
   * este campo — el código que lo consume trata `undefined` como `[]`.
   */
  links?: ExtractedLinkAnnotation[];
}
