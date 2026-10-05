import type { AppDatabase, Template } from "./model/types.js";
import { createId, nowIso } from "./ids.js";
import { appendHistory } from "./history.js";

const DEFAULT_TEMPLATE_BASE: Omit<
  Template,
  "id" | "name" | "derivedFromTemplateId" | "createdAt" | "updatedAt"
> = {
  typography: {
    fontFamily: "Inter",
    baseFontSize: 10.5,
    lineHeight: 1.35,
    headingScale: 1.15,
    fontWeight: 400,
    headingWeight: 700,
    headingCase: "uppercase",
    headingLetterSpacing: 0.4,
    textAlignment: "left",
  },
  colors: { text: "#1a1a1a", background: "#ffffff", accent: "#2563eb", muted: "#6b7280", border: "#e5e7eb" },
  spacing: {
    sectionGap: 14,
    itemGap: 8,
    margins: { top: 24, right: 24, bottom: 24, left: 24 },
    paragraphSpacing: 4,
  },
  sectionTitleStyle: { alignment: "left", spacing: 6 },
  headerStyle: { alignment: "left", height: 90, padding: 12, layout: "stacked", nameFontSize: 28 },
  dateStyle: { position: "right", format: "MMM YYYY" },
  bulletStyle: { shape: "circle", indent: 10, gap: 3 },
  separators: { style: "line", thickness: 1, borderRadius: 4 },
  linkStyle: { appearance: "accent_underline" },
  languagesStyle: { alignment: "center", mode: "columns" },
};

export function createTemplate(
  db: AppDatabase,
  params: { name: string; overrides?: Partial<typeof DEFAULT_TEMPLATE_BASE> }
): { db: AppDatabase; template: Template } {
  const timestamp = nowIso();
  const template: Template = {
    id: createId(),
    name: params.name,
    derivedFromTemplateId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...DEFAULT_TEMPLATE_BASE,
    ...params.overrides,
  };

  let next: AppDatabase = { ...db, templates: [...db.templates, template] };
  next = appendHistory(next, {
    type: "template_created",
    entityType: "template",
    entityId: template.id,
    summary: `Template "${template.name}" creado`,
  });
  return { db: next, template };
}

function getTemplateOrThrow(db: AppDatabase, templateId: string): Template {
  const template = db.templates.find((t) => t.id === templateId);
  if (!template) throw new Error(`Template not found: ${templateId}`);
  return template;
}

/** "Save": actualiza el template actual in-place (afecta a todos los CVs que lo usan). */
export function updateTemplate(
  db: AppDatabase,
  templateId: string,
  patch: Partial<Omit<Template, "id" | "createdAt">>
): { db: AppDatabase; template: Template } {
  const existing = getTemplateOrThrow(db, templateId);
  const updated: Template = { ...existing, ...patch, id: existing.id, updatedAt: nowIso() };

  let next: AppDatabase = {
    ...db,
    templates: db.templates.map((t) => (t.id === templateId ? updated : t)),
  };
  next = appendHistory(next, {
    type: "template_modified",
    entityType: "template",
    entityId: updated.id,
    summary: `Template "${updated.name}" modificado`,
  });
  return { db: next, template: updated };
}

/** "Save as new template": bifurca el template, sin tocar el original (§10 del contexto). */
export function forkTemplate(
  db: AppDatabase,
  sourceTemplateId: string,
  newName: string,
  patch: Partial<Omit<Template, "id" | "createdAt" | "derivedFromTemplateId">> = {}
): { db: AppDatabase; template: Template } {
  const source = getTemplateOrThrow(db, sourceTemplateId);
  const timestamp = nowIso();
  const forked: Template = {
    ...source,
    ...patch,
    id: createId(),
    name: newName,
    derivedFromTemplateId: source.id,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  let next: AppDatabase = { ...db, templates: [...db.templates, forked] };
  next = appendHistory(next, {
    type: "template_forked",
    entityType: "template",
    entityId: forked.id,
    summary: `Template "${forked.name}" creado a partir de "${source.name}"`,
  });
  return { db: next, template: forked };
}
