import type { FieldDefinition, FieldValue, LinkListEntry } from "../../../domain/model/types.js";
import { plainTextToRichText, richTextToPlainText } from "../../../domain/richtext.js";
import { isDateRangeValue, isLinkListValue, isRichTextDoc } from "../../../domain/fieldValueGuards.js";

/**
 * Renderiza un formulario completo a partir de un fieldSchema de sección.
 * Genérico a propósito: funciona igual para secciones estándar y custom,
 * porque ambas usan el mismo FieldDefinition[] (ARCHITECTURE.md §5).
 */
export function FieldInputs({
  fieldSchema,
  values,
  onChange,
}: {
  fieldSchema: FieldDefinition[];
  values: Record<string, FieldValue>;
  onChange: (next: Record<string, FieldValue>) => void;
}) {
  function setField(key: string, value: FieldValue) {
    onChange({ ...values, [key]: value });
  }

  const orderedFields = [...fieldSchema].sort((a, b) => a.order - b.order);

  return (
    <>
      {orderedFields.map((field) => (
        <label key={field.id} className="entity-form__field">
          <span>
            {field.label}
            {field.required ? " *" : ""}
          </span>
          <FieldInput field={field} value={values[field.key] ?? null} onChange={(v) => setField(field.key, v)} />
        </label>
      ))}
    </>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDefinition;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
}) {
  switch (field.type) {
    case "text":
    case "url":
      return (
        <input
          type={field.type === "url" ? "url" : "text"}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );

    case "longtext":
      return (
        <textarea
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );

    case "richtext":
      // Textarea de texto plano con una sintaxis mínima propia (documentada
      // también en ARCHITECTURE.md): una línea = un párrafo; "· " al
      // principio de línea = bullet; *texto* = negrita; **texto** = cursiva
      // (al revés que en Markdown de verdad, así lo pidió el usuario). El
      // modelo de datos ya soporta el AST completo (RichTextDoc); esto es
      // el editor mínimo hasta que exista uno de texto enriquecido real.
      return (
        <div className="richtext-input">
          <textarea
            rows={4}
            value={richTextToPlainText(isRichTextDoc(value) ? value : null)}
            onChange={(e) => onChange(plainTextToRichText(e.target.value))}
          />
          <span className="richtext-input__hint">
            "· " al principio de línea = viñeta · *negrita* · **cursiva**
          </span>
        </div>
      );

    case "boolean":
      return <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />;

    case "date":
      return (
        <input
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "daterange": {
      const range = isDateRangeValue(value) ? value : {};
      return (
        <span className="daterange-input">
          <input
            type="date"
            aria-label="Fecha de inicio"
            value={range.start ?? ""}
            onChange={(e) => onChange({ ...range, start: e.target.value })}
          />
          <input
            type="date"
            aria-label="Fecha de fin"
            value={range.end ?? ""}
            disabled={range.current === true}
            onChange={(e) => onChange({ ...range, end: e.target.value })}
          />
          <label>
            <input
              type="checkbox"
              checked={range.current === true}
              onChange={(e) => onChange({ ...range, current: e.target.checked })}
            />
            Actual
          </label>
        </span>
      );
    }

    case "tags":
    case "list":
      return (
        <input
          type="text"
          placeholder="separado, por, comas"
          value={Array.isArray(value) ? value.join(", ") : ""}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
        />
      );

    case "linklist": {
      // Cada enlace con su propio nombre (p.ej. "LinkedIn") aparte de la
      // URL en sí, para poder mostrar ese nombre en la preview en vez de la
      // URL completa (ver preview.ts / CVPreview.tsx).
      const entries: LinkListEntry[] = isLinkListValue(value) ? value : [];

      function updateEntry(index: number, patch: Partial<LinkListEntry>) {
        onChange(entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
      }
      function removeEntry(index: number) {
        onChange(entries.filter((_, i) => i !== index));
      }
      function addEntry() {
        onChange([...entries, { label: "", url: "" }]);
      }

      return (
        <div className="linklist-input">
          {entries.map((entry, i) => (
            <div key={i} className="linklist-input__row">
              <input
                type="text"
                placeholder="Texto a mostrar (vacío = se adivina del dominio)"
                value={entry.label}
                onChange={(e) => updateEntry(i, { label: e.target.value })}
              />
              <input
                type="url"
                placeholder="https://..."
                value={entry.url}
                onChange={(e) => updateEntry(i, { url: e.target.value })}
              />
              <button type="button" className="link-button link-button--danger" onClick={() => removeEntry(i)}>
                Quitar
              </button>
            </div>
          ))}
          <button type="button" className="link-button" onClick={addEntry}>
            + Añadir enlace
          </button>
        </div>
      );
    }

    case "select":
      // Sin opciones configurables todavía (fuera del alcance de esta
      // fase): de momento, texto libre en vez de un <select> con opciones
      // fijas.
      return (
        <input type="text" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
      );

    default:
      return null;
  }
}
