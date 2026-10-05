import { useState, type CSSProperties } from "react";
import type { AppStore } from "../../state/appStore.js";
import type { AppDatabase, HeadingCase, Template, TextAlignment } from "../../../domain/model/types.js";
import { CVPreview } from "./CVPreview.js";
import { PreviewViewport } from "./PreviewViewport.js";
import { sortAlpha } from "../sortAlpha.js";
import { useHeightDerivedWidth } from "../useHeightDerivedWidth.js";

/** Fuentes seguras del sistema (sin depender de ninguna carga externa —
 * la app es 100% local, §13/§24 del contexto). El primer nombre de cada
 * pila es el que se muestra en el desplegable. */
const FONT_OPTIONS = [
  "Inter, system-ui, sans-serif",
  "Arial, Helvetica, sans-serif",
  "Helvetica, Arial, sans-serif",
  "Georgia, 'Times New Roman', serif",
  "'Times New Roman', Times, serif",
  "Roboto, system-ui, sans-serif",
  "Calibri, Candara, sans-serif",
  "Garamond, 'Times New Roman', serif",
  "Verdana, Geneva, sans-serif",
  "'Courier New', Courier, monospace",
];

function fontLabel(stack: string): string {
  return stack.split(",")[0]!.replace(/['"]/g, "").trim();
}

type StyleBagKey =
  | "sectionTitleStyle"
  | "headerStyle"
  | "dateStyle"
  | "bulletStyle"
  | "separators"
  | "linkStyle"
  | "languagesStyle";

function bagString(bag: Record<string, unknown>, key: string, fallback: string): string {
  const v = bag[key];
  return typeof v === "string" ? v : fallback;
}
function bagNumber(bag: Record<string, unknown>, key: string, fallback: number): number {
  const v = bag[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/**
 * Editor de template (Fase 7) + preview en vivo (a petición explícita del
 * usuario): el borrador (`draft`) se pasa directamente a CVPreview como
 * `templateOverride`, así que cada cambio de un campo se refleja al
 * instante en el CV de ejemplo de la derecha, SIN necesidad de pulsar
 * "Guardar" — es justo lo contrario de cómo se guardan los cambios (que sí
 * siguen requiriendo confirmación explícita, ver más abajo): la preview es
 * de solo lectura y no persiste nada, así que no hay ningún riesgo en
 * mostrarla en vivo.
 *
 * "Guardar" (in-place, afecta a todos los CVs que usan esta template) y
 * "Guardar como nueva template" (bifurca, §10 del contexto) siguen
 * requiriendo una acción explícita — eso no cambia: lo único que ahora es
 * inmediato es la PREVISUALIZACIÓN, nunca el guardado real.
 *
 * Los botones de acción (Guardar / Guardar como nueva template / Eliminar)
 * viven en la barra de arriba, igual que en CVComposer (a petición
 * explícita), no al final del formulario.
 */
export function TemplateEditor({
  appStore,
  db,
  template,
  initialPreviewVersionId,
  onBack,
}: {
  appStore: AppStore;
  db: AppDatabase;
  template: Template;
  /** CV desde el que se llegó a este editor (si lo hay), para previsualizar con su contenido por defecto. */
  initialPreviewVersionId?: string;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState<Template>(template);
  const [previewVersionId, setPreviewVersionId] = useState<string>(
    (initialPreviewVersionId && db.cvVersions.some((v) => v.id === initialPreviewVersionId)
      ? initialPreviewVersionId
      : db.cvVersions[0]?.id) ?? ""
  );
  const { ref: panelRightRef, width: panelRightWidth } = useHeightDerivedWidth<HTMLDivElement>();

  function set<K extends keyof Template>(key: K, value: Template[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function setBag(key: StyleBagKey, patch: Record<string, unknown>) {
    setDraft((d) => ({ ...d, [key]: { ...(d[key] as Record<string, unknown>), ...patch } }));
  }

  function handleSave() {
    const { id, createdAt, ...patch } = draft;
    appStore.updateTemplate(template.id, patch);
  }

  function handleSaveAsNew() {
    const name = window.prompt("Nombre para la nueva template:", `${draft.name} (copia)`);
    if (!name) return;
    const { id, createdAt, derivedFromTemplateId, ...patch } = draft;
    appStore.forkTemplate(template.id, name, patch);
    onBack();
  }

  function handleDelete() {
    const refs = appStore.findReferences("template", template.id);
    if (refs.length > 0) {
      const proceed = window.confirm(
        `Esta template se usa en ${refs.length} CV(s). Si continúas, esos CVs quedarán con una ` +
          "referencia rota hasta que la restaures. ¿Enviar a la papelera de todas formas?"
      );
      if (!proceed) return;
    } else if (!window.confirm(`¿Enviar "${template.name}" a la papelera?`)) {
      return;
    }
    appStore.trashTemplate(template.id);
    onBack();
  }

  const fontOptions = FONT_OPTIONS.includes(draft.typography.fontFamily)
    ? FONT_OPTIONS
    : [draft.typography.fontFamily, ...FONT_OPTIONS];

  return (
    <div className="template-editor">
      <div className="template-editor__toolbar">
        <button className="link-button" onClick={onBack}>
          ← Todas las templates
        </button>
        <h1>{template.name}</h1>
        <div className="template-editor__controls">
          <button className="link-button" onClick={handleSave}>
            Guardar
          </button>
          <button className="link-button" onClick={handleSaveAsNew}>
            Guardar como nueva template
          </button>
          <button className="link-button link-button--danger" onClick={handleDelete}>
            Eliminar
          </button>
        </div>
      </div>

      <div
        className="template-editor__split"
        style={panelRightWidth !== undefined ? ({ "--panel-right-width": `${panelRightWidth}px` } as CSSProperties) : undefined}
      >
        <div className="template-editor__panel-left">
          <label className="entity-form__field">
            <span>Nombre</span>
            <input value={draft.name} onChange={(e) => set("name", e.target.value)} />
          </label>

          <h2 className="template-editor__group-title">Tipografía</h2>
          <div className="template-editor__grid">
            <label className="entity-form__field">
              <span>Familia de fuente</span>
              <select
                value={draft.typography.fontFamily}
                onChange={(e) => set("typography", { ...draft.typography, fontFamily: e.target.value })}
              >
                {fontOptions.map((stack) => (
                  <option key={stack} value={stack}>
                    {fontLabel(stack)}
                  </option>
                ))}
              </select>
            </label>
            <label className="entity-form__field">
              <span>Tamaño base (pt)</span>
              <input
                type="number"
                step="0.5"
                value={draft.typography.baseFontSize}
                onChange={(e) => set("typography", { ...draft.typography, baseFontSize: Number(e.target.value) })}
              />
            </label>
            <label className="entity-form__field">
              <span>Interlineado</span>
              <input
                type="number"
                step="0.05"
                value={draft.typography.lineHeight}
                onChange={(e) => set("typography", { ...draft.typography, lineHeight: Number(e.target.value) })}
              />
            </label>
            <label className="entity-form__field">
              <span>Escala de títulos</span>
              <input
                type="number"
                step="0.05"
                value={draft.typography.headingScale}
                onChange={(e) => set("typography", { ...draft.typography, headingScale: Number(e.target.value) })}
              />
            </label>
            <label className="entity-form__field">
              <span>Grosor del texto base</span>
              <select
                value={draft.typography.fontWeight}
                onChange={(e) => set("typography", { ...draft.typography, fontWeight: Number(e.target.value) })}
              >
                {[300, 400, 500, 600, 700].map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </label>
            <label className="entity-form__field">
              <span>Grosor de títulos</span>
              <select
                value={draft.typography.headingWeight}
                onChange={(e) => set("typography", { ...draft.typography, headingWeight: Number(e.target.value) })}
              >
                {[400, 500, 600, 700, 800].map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </label>
            <label className="entity-form__field">
              <span>Mayúsculas de títulos</span>
              <select
                value={draft.typography.headingCase}
                onChange={(e) => set("typography", { ...draft.typography, headingCase: e.target.value as HeadingCase })}
              >
                <option value="none">Normal</option>
                <option value="uppercase">MAYÚSCULAS</option>
                <option value="capitalize">Cada Palabra</option>
              </select>
            </label>
            <label className="entity-form__field">
              <span>Espaciado de letras de títulos (px)</span>
              <input
                type="number"
                step="0.1"
                value={draft.typography.headingLetterSpacing}
                onChange={(e) =>
                  set("typography", { ...draft.typography, headingLetterSpacing: Number(e.target.value) })
                }
              />
            </label>
            <label className="entity-form__field">
              <span>Alineación del contenido</span>
              <AlignmentSelect
                value={draft.typography.textAlignment}
                onChange={(v) => set("typography", { ...draft.typography, textAlignment: v })}
              />
            </label>
          </div>

          <h2 className="template-editor__group-title">Colores</h2>
          <div className="template-editor__grid">
            {(["text", "background", "accent", "muted", "border"] as const).map((key) => (
              <label key={key} className="entity-form__field">
                <span>{colorLabel(key)}</span>
                <div className="template-editor__color-input">
                  <input
                    type="color"
                    value={draft.colors[key]}
                    onChange={(e) => set("colors", { ...draft.colors, [key]: e.target.value })}
                  />
                  <input value={draft.colors[key]} onChange={(e) => set("colors", { ...draft.colors, [key]: e.target.value })} />
                </div>
              </label>
            ))}
          </div>

          <h2 className="template-editor__group-title">Espaciado</h2>
          <div className="template-editor__grid">
            <label className="entity-form__field">
              <span>Espacio entre secciones (px)</span>
              <input
                type="number"
                value={draft.spacing.sectionGap}
                onChange={(e) => set("spacing", { ...draft.spacing, sectionGap: Number(e.target.value) })}
              />
            </label>
            <label className="entity-form__field">
              <span>Espacio entre items (px)</span>
              <input
                type="number"
                value={draft.spacing.itemGap}
                onChange={(e) => set("spacing", { ...draft.spacing, itemGap: Number(e.target.value) })}
              />
            </label>
            <label className="entity-form__field">
              <span>Espacio entre párrafos (px)</span>
              <input
                type="number"
                value={draft.spacing.paragraphSpacing}
                onChange={(e) => set("spacing", { ...draft.spacing, paragraphSpacing: Number(e.target.value) })}
              />
            </label>
            {(["top", "right", "bottom", "left"] as const).map((key) => (
              <label key={key} className="entity-form__field">
                <span>Margen {marginLabel(key)} (mm)</span>
                <input
                  type="number"
                  value={draft.spacing.margins[key]}
                  onChange={(e) =>
                    set("spacing", { ...draft.spacing, margins: { ...draft.spacing.margins, [key]: Number(e.target.value) } })
                  }
                />
              </label>
            ))}
          </div>

          <h2 className="template-editor__group-title">Título de sección</h2>
          <div className="template-editor__grid">
            <label className="entity-form__field">
              <span>Alineación</span>
              <AlignmentSelect
                value={bagString(draft.sectionTitleStyle, "alignment", "left") as TextAlignment}
                onChange={(v) => setBag("sectionTitleStyle", { alignment: v })}
              />
            </label>
            <label className="entity-form__field">
              <span>Distancia al contenido (px)</span>
              <input
                type="number"
                value={bagNumber(draft.sectionTitleStyle, "spacing", 6)}
                onChange={(e) => setBag("sectionTitleStyle", { spacing: Number(e.target.value) })}
              />
            </label>
          </div>

          <h2 className="template-editor__group-title">Encabezado</h2>
          <div className="template-editor__grid">
            <label className="entity-form__field">
              <span>Diseño</span>
              <select
                value={bagString(draft.headerStyle, "layout", "stacked")}
                onChange={(e) => {
                  const layout = e.target.value;
                  // Cambiar el diseño actualiza también la alineación a un
                  // valor por defecto razonable para ese diseño (izquierda
                  // para la lista de siempre, centrada para el banner, que
                  // en la imagen de referencia del usuario va centrado) —
                  // el usuario puede cambiarla a mano después si quiere otra.
                  setBag("headerStyle", { layout, alignment: layout === "banner" ? "center" : "left" });
                }}
              >
                <option value="stacked">Lista (un campo debajo de otro)</option>
                <option value="banner">Banner (nombre grande + contacto en una línea)</option>
              </select>
            </label>
            <label className="entity-form__field">
              <span>Alineación</span>
              <AlignmentSelect
                value={bagString(draft.headerStyle, "alignment", "left") as TextAlignment}
                onChange={(v) => setBag("headerStyle", { alignment: v })}
              />
            </label>
            {bagString(draft.headerStyle, "layout", "stacked") === "banner" ? (
              <label className="entity-form__field">
                <span>Tamaño del nombre (px)</span>
                <input
                  type="number"
                  value={bagNumber(draft.headerStyle, "nameFontSize", 28)}
                  onChange={(e) => setBag("headerStyle", { nameFontSize: Number(e.target.value) })}
                />
              </label>
            ) : (
              <>
                <label className="entity-form__field">
                  <span>Altura (px)</span>
                  <input
                    type="number"
                    value={bagNumber(draft.headerStyle, "height", 90)}
                    onChange={(e) => setBag("headerStyle", { height: Number(e.target.value) })}
                  />
                </label>
                <label className="entity-form__field">
                  <span>Padding interno (px)</span>
                  <input
                    type="number"
                    value={bagNumber(draft.headerStyle, "padding", 12)}
                    onChange={(e) => setBag("headerStyle", { padding: Number(e.target.value) })}
                  />
                </label>
              </>
            )}
          </div>

          <h2 className="template-editor__group-title">Fechas</h2>
          <div className="template-editor__grid">
            <label className="entity-form__field">
              <span>Posición</span>
              <select
                value={bagString(draft.dateStyle, "position", "right")}
                onChange={(e) => setBag("dateStyle", { position: e.target.value })}
              >
                <option value="right">Derecha</option>
                <option value="left">Izquierda</option>
                <option value="inline">En línea con el título</option>
              </select>
            </label>
            <label className="entity-form__field">
              <span>Formato</span>
              <select
                value={bagString(draft.dateStyle, "format", "MMM YYYY")}
                onChange={(e) => setBag("dateStyle", { format: e.target.value })}
              >
                <option value="MMM YYYY">mmm AAAA (jun 2024)</option>
                <option value="MM/YYYY">MM/AAAA (06/2024)</option>
                <option value="YYYY">Solo el año (2024)</option>
              </select>
            </label>
          </div>

          <h2 className="template-editor__group-title">Idiomas</h2>
          <div className="template-editor__grid">
            <label className="entity-form__field">
              <span>Alineación</span>
              <select
                value={bagString(draft.languagesStyle, "alignment", "center")}
                onChange={(e) => setBag("languagesStyle", { alignment: e.target.value })}
              >
                <option value="left">Izquierda</option>
                <option value="center">Centrado</option>
                <option value="right">Derecha</option>
              </select>
            </label>
            <label className="entity-form__field">
              <span>Modo</span>
              <select
                value={bagString(draft.languagesStyle, "mode", "columns")}
                onChange={(e) => setBag("languagesStyle", { mode: e.target.value })}
              >
                <option value="columns">Columnas (una por idioma, en fila)</option>
                <option value="row">Fila (apilados, como el resto de secciones)</option>
                <option value="list">Lista (Español (Nativo), Inglés (B2)...)</option>
              </select>
            </label>
          </div>

          <h2 className="template-editor__group-title">Viñetas</h2>
          <div className="template-editor__grid">
            <label className="entity-form__field">
              <span>Forma</span>
              <select
                value={bagString(draft.bulletStyle, "shape", "circle")}
                onChange={(e) => setBag("bulletStyle", { shape: e.target.value })}
              >
                <option value="circle">Punto (•)</option>
                <option value="dash">Guion (–)</option>
                <option value="square">Cuadrado (▪)</option>
                <option value="none">Ninguna</option>
              </select>
            </label>
            <label className="entity-form__field">
              <span>Sangría (px)</span>
              <input
                type="number"
                value={bagNumber(draft.bulletStyle, "indent", 10)}
                onChange={(e) => setBag("bulletStyle", { indent: Number(e.target.value) })}
              />
            </label>
            <label className="entity-form__field">
              <span>Distancia al texto (px)</span>
              <input
                type="number"
                value={bagNumber(draft.bulletStyle, "gap", 3)}
                onChange={(e) => setBag("bulletStyle", { gap: Number(e.target.value) })}
              />
            </label>
          </div>

          <h2 className="template-editor__group-title">Separadores y enlaces</h2>
          <div className="template-editor__grid">
            <label className="entity-form__field">
              <span>Separador de secciones</span>
              <select
                value={bagString(draft.separators, "style", "line")}
                onChange={(e) => setBag("separators", { style: e.target.value })}
              >
                <option value="line">Línea</option>
                <option value="dots">Puntos</option>
                <option value="none">Ninguno</option>
              </select>
            </label>
            <label className="entity-form__field">
              <span>Grosor del separador (px)</span>
              <input
                type="number"
                value={bagNumber(draft.separators, "thickness", 1)}
                onChange={(e) => setBag("separators", { thickness: Number(e.target.value) })}
              />
            </label>
            <label className="entity-form__field">
              <span>Redondeo de elementos (px)</span>
              <input
                type="number"
                value={bagNumber(draft.separators, "borderRadius", 4)}
                onChange={(e) => setBag("separators", { borderRadius: Number(e.target.value) })}
              />
            </label>
            <label className="entity-form__field">
              <span>Apariencia de enlaces</span>
              <select
                value={bagString(draft.linkStyle, "appearance", "accent_underline")}
                onChange={(e) => setBag("linkStyle", { appearance: e.target.value })}
              >
                <option value="accent_underline">Color de acento + subrayado</option>
                <option value="accent">Solo color de acento</option>
                <option value="underline">Solo subrayado</option>
                <option value="plain">Como texto normal</option>
              </select>
            </label>
          </div>
        </div>

        <div className="template-editor__panel-right" ref={panelRightRef}>
          {db.cvVersions.length === 0 ? (
            <p className="empty-state">
              Todavía no tienes ningún CV con contenido para previsualizar esta template. Crea uno
              primero desde el Dashboard.
            </p>
          ) : (
            <>
              <label className="template-editor__preview-picker">
                <span>Previsualizar con:</span>
                <select value={previewVersionId} onChange={(e) => setPreviewVersionId(e.target.value)}>
                  {sortAlpha(db.cvProjects, (p) => p.name).map((project) =>
                    sortAlpha(
                      project.versionIds
                        .map((versionId) => db.cvVersions.find((vv) => vv.id === versionId))
                        .filter((v): v is NonNullable<typeof v> => Boolean(v)),
                      (v) => v.label
                    ).map((v) => (
                      <option key={v.id} value={v.id}>
                        {project.name} — {v.label}
                      </option>
                    ))
                  )}
                </select>
              </label>
              {previewVersionId && (
                <PreviewViewport>
                  <CVPreview db={db} cvVersionId={previewVersionId} templateOverride={draft} />
                </PreviewViewport>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AlignmentSelect({ value, onChange }: { value: TextAlignment; onChange: (v: TextAlignment) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as TextAlignment)}>
      <option value="left">Izquierda</option>
      <option value="center">Centrado</option>
      <option value="right">Derecha</option>
      <option value="justify">Justificado</option>
    </select>
  );
}

function colorLabel(key: "text" | "background" | "accent" | "muted" | "border"): string {
  const labels = { text: "Texto", background: "Fondo", accent: "Acento", muted: "Atenuado", border: "Bordes" };
  return labels[key];
}
function marginLabel(key: "top" | "right" | "bottom" | "left"): string {
  const labels = { top: "superior", right: "derecho", bottom: "inferior", left: "izquierdo" };
  return labels[key];
}
