/**
 * Dispara la descarga de un texto como fichero en el navegador, vía un
 * Blob + un <a download> temporal. API estándar del navegador, sin
 * dependencias — vive en la UI (usa `document`/`URL`), no en el dominio.
 */
export function downloadTextFile(filename: string, content: string, mimeType = "application/json"): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Nombre sugerido para el PDF exportado de un CV: el propio nombre del
 * CV. `window.print()` no acepta un nombre de archivo explícito (no es
 * `downloadTextFile`, exporta vía el diálogo de impresión del navegador),
 * pero Chrome/Edge SÍ usan `document.title` como nombre de archivo
 * sugerido — así que este valor está pensado para asignarse temporalmente
 * a `document.title` justo antes de llamar a `window.print()`.
 */
export function suggestCvPdfFilename(cvName: string): string {
  const trimmed = cvName.trim();
  return trimmed || "CV";
}
