import type { DateRangeValue, FieldValue, LinkListEntry, RichTextDoc } from "./model/types.js";

/**
 * Ambos tipos son objetos no-array dentro de la unión FieldValue, así que se
 * distinguen por la presencia de "blocks" (exclusivo de RichTextDoc). Vive
 * en el dominio, no en la UI, para poder testearse y para que
 * FieldInputs.tsx (formularios) y el renderer de preview usen exactamente
 * la misma lógica sin duplicarla.
 */
export function isRichTextDoc(value: FieldValue): value is RichTextDoc {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && "blocks" in value);
}

export function isDateRangeValue(value: FieldValue): value is DateRangeValue {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && !("blocks" in value));
}

/**
 * Un array de FieldValue puede ser un `string[]` (tipo "list"/"tags") o un
 * `LinkListEntry[]` (tipo "linklist") — ambos son arrays, así que hace
 * falta mirar el PRIMER elemento para distinguirlos. Con un array vacío no
 * hay forma de saberlo por la forma del valor: quien llame a esto para un
 * array vacío debería fiarse del `FieldDefinition.type` en su lugar, no de
 * estas funciones (por eso ambas devuelven `false` para `[]`).
 */
export function isLinkListValue(value: FieldValue): value is LinkListEntry[] {
  return Array.isArray(value) && value.length > 0 && typeof value[0] === "object";
}

export function isStringListValue(value: FieldValue): value is string[] {
  return Array.isArray(value) && value.length > 0 && typeof value[0] === "string";
}
