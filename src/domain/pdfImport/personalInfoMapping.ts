import type { FieldDefinition, FieldValue, SectionDefinition } from "../model/types.js";
import { guessLinkLabel } from "../linkLabel.js";

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b(?:linkedin\.com|github\.com|gitlab\.com)\/\S+/i;
// "\+?\s?" y no solo "\+?": el "+" de un teléfono a veces llega separado del
// primer dígito por un espacio de más (ver glyphFixups.ts — el "+" de
// "+34 611659219" venía de un glifo sin ToUnicode que pdf.js entrega como un
// item de texto aparte, y el espacio de unión entre items se cuela en medio).
const PHONE_RE = /\+?\s?\d[\d\s().-]{6,}\d/;

/**
 * Etiquetas explícitas tipo "Email : foo@bar.com" — bastante habituales en
 * CVs con los datos de contacto en una sola línea ("Email: x  Phone: y
 * Location: z"). Reconocerlas EXPLÍCITAMENTE (en vez de fiarse solo del
 * regex de email/teléfono + el orden de aparición) es lo que permite
 * separar tres datos que de otra forma llegan pegados en una única línea
 * — bug real: sin esto, la línea entera acababa entera en el primer campo
 * libre (normalmente "location", el último en asignarse por orden).
 */
const LABELED_FIELD_PATTERNS: Array<{ target: "email" | "phone" | "location"; pattern: RegExp }> = [
  { target: "email", pattern: /email|correo/i },
  { target: "phone", pattern: /phone|tel[eé]fono|m[oó]vil|mobile/i },
  { target: "location", pattern: /location|ubicaci[oó]n|direcci[oó]n|address/i },
];
const ANY_LABEL_RE = /\b(email|correo|phone|tel[eé]fono|m[oó]vil|mobile|location|ubicaci[oó]n|direcci[oó]n|address)\s*:\s*/gi;

/**
 * Si una línea trae VARIAS etiquetas seguidas ("Email : x Phone : y
 * Location : z"), la parte en un array con una etiqueta como mucho por
 * trozo. Si no hay ninguna etiqueta, devuelve la línea tal cual (en un
 * array de un elemento) para que siga el camino normal de abajo.
 */
function splitLabeledSegments(line: string): string[] {
  const matches = [...line.matchAll(ANY_LABEL_RE)];
  if (matches.length === 0) return [line];

  const segments: string[] = [];
  const firstIndex = matches[0]!.index!;
  if (firstIndex > 0) {
    const before = line.slice(0, firstIndex).trim();
    if (before) segments.push(before);
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i]!.index!;
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : line.length;
    const segment = line.slice(start, end).trim();
    if (segment) segments.push(segment);
  }
  return segments;
}

/** Si el segmento empieza por una etiqueta reconocida, la quita y dice a qué campo va destinado. */
function stripKnownLabel(segment: string): { target: "email" | "phone" | "location"; value: string } | null {
  for (const { target, pattern } of LABELED_FIELD_PATTERNS) {
    const match = segment.match(new RegExp(`^(?:${pattern.source})\\s*:\\s*(.*)$`, "i"));
    if (match) return { target, value: match[1]!.trim() };
  }
  return null;
}

function isMostlyDigits(text: string): boolean {
  const compact = text.replace(/\s/g, "");
  const digitCount = (compact.match(/\d/g) ?? []).length;
  return compact.length > 0 && digitCount >= Math.floor(compact.length * 0.6);
}

/** Quita puntuación de cierre pegada al final ("web.com," / "web.com)") y añade el esquema si falta. */
function normalizeUrl(raw: string): string {
  const trimmed = raw.replace(/[),.;]+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function fieldMatches(field: FieldDefinition, pattern: RegExp): boolean {
  return pattern.test(field.key.toLowerCase()) || pattern.test(field.label.toLowerCase());
}

/**
 * Extrae los campos de "Datos personales" (nombre, headline/rol, email,
 * teléfono, ubicación, links...) a partir de las líneas de texto del bloque
 * de cabecera del CV (ver `extractHeaderItems` en segmentation.ts).
 *
 * A diferencia de `mapDraftEntryToFields` (pensado para listas de entradas
 * repetidas como Experience/Education, cada una con título+fecha+
 * descripción), aquí cada línea suele ser un dato DISTINTO — de ahí que
 * necesite su propia lógica en vez de reutilizar ese heurístico genérico.
 *
 * Sigue siendo schema-driven a propósito (no asume literalmente las claves
 * por defecto de §3 del contexto): busca primero por el NOMBRE de cada
 * campo (key/label, con sinónimos en inglés/español) y, para lo que no
 * tiene un patrón reconocible en el propio texto (nombre, headline), cae de
 * vuelta al orden de aparición de las líneas — así funciona también si el
 * usuario ha renombrado o reordenado los campos de esta sección.
 */
export function extractPersonalInfoFields(
  lines: string[],
  section: SectionDefinition,
  lineLinks: (string | null)[] = []
): Record<string, FieldValue> {
  const orderedSchema = [...section.fieldSchema].sort((a, b) => a.order - b.order);
  const fields: Record<string, FieldValue> = {};

  let email: string | null = null;
  let phone: string | null = null;
  let location: string | null = null;
  const links: string[] = [];
  const remaining: string[] = [];

  lines.forEach((rawLine, lineIndex) => {
    for (const raw of splitLabeledSegments(rawLine)) {
      const line = raw.trim();
      if (!line) continue;

      const labeled = stripKnownLabel(line);
      if (labeled) {
        if (labeled.target === "email" && !email) email = labeled.value.match(EMAIL_RE)?.[0] ?? labeled.value;
        else if (labeled.target === "phone" && !phone) phone = labeled.value.replace(/^\+\s+/, "+");
        else if (labeled.target === "location" && !location) location = labeled.value;
        continue;
      }

      const emailMatch = line.match(EMAIL_RE);
      if (emailMatch && !email) {
        email = emailMatch[0];
        const rest = line.replace(emailMatch[0], "").trim();
        if (rest) remaining.push(rest);
        continue;
      }

      const urlMatch = line.match(URL_RE);
      if (urlMatch) {
        links.push(normalizeUrl(urlMatch[0]));
        const rest = line.replace(urlMatch[0], "").trim();
        if (rest) remaining.push(rest);
        continue;
      }

      if (!phone && isMostlyDigits(line)) {
        const phoneMatch = line.match(PHONE_RE);
        if (phoneMatch) {
          phone = phoneMatch[0].trim();
          const rest = line.replace(phoneMatch[0], "").trim();
          if (rest) remaining.push(rest);
          continue;
        }
      }

      remaining.push(line);
    }

    // El texto visible no siempre trae la URL (§10.2 del informe de
    // importación de PDF: un "LinkedIn" con el enlace real solo como
    // anotación PDF, sin URL visible). Si esta línea física no aportó
    // ninguna URL por texto pero SÍ hay una anotación de enlace resuelta
    // para ella, se usa esa — y si el texto visible tiene pinta de
    // etiqueta corta ("LinkedIn", "GitHub"), se considera consumido por el
    // enlace y se quita de "remaining" para que no acabe convertido en
    // nombre o headline por error.
    const trimmedLine = rawLine.trim();
    const alreadyHadUrl = URL_RE.test(rawLine);
    const resolvedLink = lineLinks[lineIndex];
    if (!alreadyHadUrl && resolvedLink) {
      links.push(normalizeUrl(resolvedLink));
      const looksLikeLinkLabel = trimmedLine.length > 0 && trimmedLine.split(/\s+/).length <= 3;
      if (looksLikeLinkLabel) {
        const idx = remaining.lastIndexOf(trimmedLine);
        if (idx !== -1) remaining.splice(idx, 1);
      }
    }
  });

  const emailField = orderedSchema.find((f) => fieldMatches(f, /email|correo/));
  const phoneField = orderedSchema.find((f) => fieldMatches(f, /phone|tel[eé]fono|m[oó]vil|mobile/));
  const locationField = orderedSchema.find((f) => fieldMatches(f, /location|ubicaci[oó]n|city|ciudad|direcci[oó]n|address/));
  const linksField = orderedSchema.find((f) => f.type === "list" || fieldMatches(f, /link|url|web|portfolio|redes/));
  const nameField =
    orderedSchema.find((f) => fieldMatches(f, /full ?name|^name$|nombre/)) ??
    orderedSchema.find((f) => f.type === "text");
  const headlineField = orderedSchema.find(
    (f) => f.key !== nameField?.key && fieldMatches(f, /headline|role|title|puesto|cargo|profesi[oó]n/)
  );

  if (email && emailField) fields[emailField.key] = email;
  if (phone && phoneField) fields[phoneField.key] = phone;
  if (location && locationField) fields[locationField.key] = location;
  if (linksField && links.length > 0) {
    if (linksField.type === "linklist") {
      fields[linksField.key] = links.map((url) => ({ label: guessLinkLabel(url), url }));
    } else if (linksField.type === "list") {
      fields[linksField.key] = links;
    } else {
      fields[linksField.key] = links[0]!;
    }
  }

  // Las líneas restantes (ni email, ni teléfono, ni URL, ni una etiqueta
  // reconocida) se reparten en orden de aparición: nombre, luego headline,
  // luego ubicación si sigue sin asignar — el orden habitual en la
  // cabecera de un CV real cuando no hay etiquetas explícitas.
  let cursor = 0;
  if (nameField && !fields[nameField.key] && remaining[cursor] !== undefined) {
    fields[nameField.key] = remaining[cursor]!;
    cursor++;
  }
  if (headlineField && !fields[headlineField.key] && remaining[cursor] !== undefined) {
    fields[headlineField.key] = remaining[cursor]!;
    cursor++;
  }
  if (locationField && !fields[locationField.key] && remaining[cursor] !== undefined) {
    fields[locationField.key] = remaining[cursor]!;
    cursor++;
  }

  return fields;
}
