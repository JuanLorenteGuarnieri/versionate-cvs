import type { RichTextBlock, RichTextDoc, RichTextRun } from "./model/types.js";

/**
 * Convierte un RichTextDoc a texto plano (una línea por párrafo/bullet,
 * sin negrita/cursiva/enlaces). Se usa para el editor simplificado de la
 * Fase 3 (un <textarea> normal) hasta que exista un editor de texto
 * enriquecido real — el modelo de datos ya soporta el AST completo
 * (ver model/types.ts), esto es solo una vista simplificada sobre él.
 *
 * Nota: esto es la vuelta atrás de `plainTextToRichText`, así que reproduce
 * la MISMA sintaxis que esa función entiende al escribir (bullets "· ",
 * *negrita*, **cursiva**) para que editar un campo ya guardado y volver a
 * guardarlo sin tocar nada dé exactamente el mismo resultado.
 */
export function richTextToPlainText(doc: RichTextDoc | null | undefined): string {
  if (!doc) return "";
  return doc.blocks
    .map((block) => {
      const text = block.runs.map(runToPlainText).join("");
      return block.kind === "bullet" ? `· ${text}` : text;
    })
    .join("\n");
}

function runToPlainText(run: RichTextRun): string {
  if (run.bold) return `*${run.text}*`;
  if (run.italic) return `**${run.text}**`;
  return run.text;
}

/**
 * Reconoce "*negrita*" y "**cursiva**" DENTRO de una línea (nótese que es
 * al revés que en Markdown de verdad — un asterisco es negrita, dos son
 * cursiva — así lo pidió el usuario explícitamente). El orden de la
 * alternancia importa: "\*\*...\*\*" va primero para que "**cursiva**" no
 * se lea como negrita vacía + texto + negrita vacía.
 */
const INLINE_MARKUP_RE = /\*\*(.+?)\*\*|\*(.+?)\*/g;

function parseInlineRuns(text: string): RichTextRun[] {
  if (!text) return [];
  const runs: RichTextRun[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE_MARKUP_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) runs.push({ text: text.slice(lastIndex, index) });
    const [full, italicText, boldText] = match;
    if (italicText !== undefined) runs.push({ text: italicText, italic: true });
    else if (boldText !== undefined) runs.push({ text: boldText, bold: true });
    lastIndex = index + full.length;
  }
  if (lastIndex < text.length) runs.push({ text: text.slice(lastIndex) });
  return runs;
}

/** "· " al principio de línea (con posible sangría delante) marca un bullet — ver bulletStyle de la template para cómo se pinta. */
const BULLET_LINE_RE = /^\s*·\s+(.*)$/;

/**
 * Conversión inversa: cada línea se convierte en un párrafo (o un bullet,
 * si empieza por "· ") con los runs de negrita/cursiva/enlace que se
 * detecten dentro. Sigue siendo una conversión con pérdida a propósito
 * (sin editor de texto enriquecido real todavía — Fase 3): solo entiende
 * esta sintaxis concreta, no Markdown completo ni HTML.
 */
export function plainTextToRichText(text: string): RichTextDoc {
  return {
    type: "richtext",
    blocks: text.split("\n").map((line): RichTextBlock => {
      const bulletMatch = line.match(BULLET_LINE_RE);
      const kind = bulletMatch ? "bullet" : "paragraph";
      const content = bulletMatch ? bulletMatch[1]! : line;
      return { kind, runs: parseInlineRuns(content) };
    }),
  };
}
