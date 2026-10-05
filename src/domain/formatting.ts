import type { DateRangeValue } from "./model/types.js";

/** Formatos de fecha que puede elegir una template (Template.dateStyle.format, §10). */
export type DateDisplayFormat = "MM/YYYY" | "YYYY" | "MMM YYYY";

/**
 * Formatea una fecha ISO ("2020-06-15") según el `format` pedido. Por
 * defecto ("MMM YYYY", el de siempre) usa el motor de fechas del propio
 * entorno (Intl), así que el formato exacto (mayúsculas, puntuación) puede
 * variar ligeramente entre navegador/Node/versión de ICU — por eso los
 * tests de este fichero comprueban el CONTENIDO (que aparezca el año,
 * "Actualidad", etc.), no la cadena exacta para ese caso. Los formatos
 * "MM/YYYY" y "YYYY" son puramente numéricos, así que esos sí dan una
 * cadena exacta y predecible.
 */
export function formatIsoDateForDisplay(
  iso: string | null | undefined,
  locale = "es-ES",
  format: DateDisplayFormat = "MMM YYYY"
): string {
  if (!iso) return "";
  // Se añade la hora explícitamente para que el navegador no interprete la
  // fecha en UTC y la muestre un día antes en zonas horarias negativas.
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso; // valor no reconocible: se muestra tal cual, no se oculta

  if (format === "YYYY") return String(date.getFullYear());
  if (format === "MM/YYYY") return `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
  return date.toLocaleDateString(locale, { month: "short", year: "numeric" });
}

/**
 * Formatea un DateRangeValue completo, respetando "current" (§ del
 * contexto: los CVs muestran "Actualidad"/equivalente en vez de una fecha
 * de fin). `currentLabel` es traducible (ver i18n.ts) porque, a diferencia
 * del resto de este fichero (formato numérico/Intl puro), es texto fijo
 * que la propia app decide mostrar, no dato del usuario.
 */
export function formatDateRangeForDisplay(
  range: DateRangeValue | null | undefined,
  locale = "es-ES",
  format: DateDisplayFormat = "MMM YYYY",
  currentLabel = "Actualidad"
): string {
  if (!range) return "";
  const start = formatIsoDateForDisplay(range.start, locale, format);
  const end = range.current ? currentLabel : formatIsoDateForDisplay(range.end, locale, format);
  if (start && end) return `${start} – ${end}`;
  return start || end;
}

/**
 * Formatea una marca de tiempo ISO completa (fecha + hora) para el
 * historial de cambios. Igual que las de arriba: el formato exacto depende
 * de Intl/ICU, por eso los tests comprueban contenido, no la cadena exacta.
 */
export function formatTimestampForDisplay(iso: string, locale = "es-ES"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}
