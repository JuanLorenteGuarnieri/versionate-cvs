import type { AppDatabase } from "../model/types.js";
import { getVisibleSections, resolveCV } from "../resolveCV.js";
import { buildItemLayout, type ItemLayout } from "../preview.js";
import { richTextToPlainText } from "../richtext.js";

/**
 * Aplana un `ItemLayout` ya construido (título/subtítulo/descripciones/
 * tags/meta) a texto plano — extraído de `extractCvPlainText` para poder
 * reutilizarlo también al puntuar un elemento suelto de la base de datos
 * contra una oferta de trabajo (ver jobMatching.ts), sin tener que resolver
 * un CV completo para ello.
 */
export function extractItemLayoutPlainText(layout: ItemLayout): string {
  const parts: string[] = [];
  if (layout.title) parts.push(layout.title);
  if (layout.subtitle) parts.push(layout.subtitle);
  if (layout.locationText) parts.push(layout.locationText);
  for (const doc of layout.descriptions) parts.push(richTextToPlainText(doc));
  for (const tagList of layout.tags) parts.push(...tagList.map((tag) => tag.text));
  for (const meta of layout.meta) parts.push(meta.value);
  return parts.join("\n");
}

/**
 * Extrae todo el texto visible de un CV (igual que lo vería un lector
 * humano o un sistema ATS) como una única cadena, para poder tokenizarlo y
 * compararlo con una oferta de trabajo. Reutiliza `buildItemLayout` (ya
 * testeado en preview.ts) en vez de volver a decidir qué es título/
 * descripción/etc.
 */
export function extractCvPlainText(db: AppDatabase, cvVersionId: string): string {
  const resolved = resolveCV(db, cvVersionId);
  const sections = getVisibleSections(resolved);

  const parts: string[] = [];
  for (const section of sections) {
    parts.push(section.title);
    for (const item of section.items) {
      const layout = buildItemLayout(item.fields);
      const text = extractItemLayoutPlainText(layout);
      if (text) parts.push(text);
    }
  }
  return parts.join("\n");
}
