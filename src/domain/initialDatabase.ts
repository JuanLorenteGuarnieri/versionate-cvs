import type { AppDatabase, FieldValue } from "./model/types.js";
import { createCVProject, setSectionItems } from "./cv.js";
import { createEmptyDatabase } from "./database.js";
import { createTemplate } from "./templates.js";
import { createElement } from "./variants.js";

const TEMPLATE_OVERRIDES = {
  typography: {
    fontWeight: 400,
    headingWeight: 800,
    headingCase: "uppercase" as const,
    headingLetterSpacing: 0.4,
    textAlignment: "left" as const,
    fontFamily: "Inter, system-ui, sans-serif",
    baseFontSize: 10,
    lineHeight: 1.25,
    headingScale: 1.25,
  },
  colors: {
    text: "#1a1a1a",
    background: "#ffffff",
    accent: "#546996",
    muted: "#909298",
    border: "#a0a8ba",
  },
  spacing: {
    paragraphSpacing: 3,
    sectionGap: 9,
    itemGap: 6,
    margins: { top: 13, right: 13, bottom: 10, left: 13 },
  },
  sectionTitleStyle: { alignment: "left", spacing: 5 },
  headerStyle: { alignment: "center", layout: "banner", nameFontSize: 31 },
  dateStyle: {},
  bulletStyle: { shape: "square", indent: 0, gap: 9 },
  separators: { style: "line", thickness: 1, borderRadius: 6 },
  linkStyle: { appearance: "accent_underline" },
  languagesStyle: { alignment: "center", mode: "columns" },
};

function paragraph(text: string): FieldValue {
  return { type: "richtext", blocks: [{ kind: "paragraph", runs: [{ text }] }] };
}

function bullet(text: string): FieldValue {
  return { type: "richtext", blocks: [{ kind: "bullet", runs: [{ text }] }] };
}

const SAMPLE_ITEMS: Array<{ sectionKey: string; fields: Record<string, FieldValue> }> = [
  {
    sectionKey: "personal-information",
    fields: {
      fullName: "Alex Example",
      headline: "Junior Software Developer",
      email: "alex@example.com",
      phone: "+1 202 555 0140",
      location: "Example City",
      links: [{ label: "Portfolio", url: "https://example.com" }],
    },
  },
  {
    sectionKey: "profile",
    fields: {
      summary: paragraph("Curious software developer who enjoys building clear, accessible web applications and learning new technologies."),
    },
  },
  {
    sectionKey: "skills",
    fields: {
      programmingLanguages: ["TypeScript", "JavaScript"],
      technologies: ["React", "Node.js", "Git"],
      softSkills: ["Communication", "Problem solving"],
    },
  },
  {
    sectionKey: "experience",
    fields: {
      role: "Junior Software Developer",
      company: "Example Studio",
      location: "Example City",
      dateRange: { start: "2023-01-01", end: "2025-01-01" },
      description: bullet("Built and maintained responsive interface components with a focus on accessibility and reliable behavior."),
      technologies: ["TypeScript", "React"],
    },
  },
  {
    sectionKey: "education",
    fields: {
      degree: "BSc in Computer Science",
      institution: "Example University",
      location: "Example City",
      dateRange: { start: "2019-09-01", end: "2023-06-30" },
      description: paragraph("Coursework included software engineering, databases, and human-computer interaction."),
    },
  },
  {
    sectionKey: "projects",
    fields: {
      title: "Community Task Board",
      subtitle: "Personal project",
      description: bullet("Created a small task board to practice frontend development and collaborative workflows."),
      technologies: ["React", "TypeScript", "CSS"],
      url: [{ label: "Demo", url: "https://example.com" }],
    },
  },
  {
    sectionKey: "languages",
    fields: { name: "English", level: "Fluent" },
  },
  {
    sectionKey: "certifications",
    fields: {
      name: "Web Development Foundations",
      issuer: "Example Learning",
      date: "2024-06-01",
      url: [{ label: "Certificate", url: "https://example.com" }],
    },
  },
  {
    sectionKey: "awards",
    fields: {
      title: "Community Coding Award",
      issuer: "Example Foundation",
      date: "2023-05-01",
      description: paragraph("Recognized for contributing to a student-led accessibility project."),
    },
  },
  {
    sectionKey: "publications",
    fields: {
      title: "Building Accessible Web Interfaces",
      venue: "Example Technology Journal",
      date: "2024-02-01",
      url: [{ label: "Article", url: "https://example.com" }],
    },
  },
  {
    sectionKey: "courses",
    fields: {
      title: "Modern TypeScript",
      institution: "Example Learning",
      date: "2024-03-01",
    },
  },
  {
    sectionKey: "volunteering",
    fields: {
      role: "Volunteer Coding Mentor",
      organization: "Community Learning Center",
      dateRange: { start: "2022-09-01", end: "2023-06-30" },
      description: paragraph("Helped beginners build confidence with programming through weekly workshops."),
    },
  },
  {
    sectionKey: "references",
    fields: {
      name: "Taylor Sample",
      relation: "Former supervisor",
      contact: "taylor@example.com",
    },
  },
];

export function createInitialDatabase(): AppDatabase {
  let db = createEmptyDatabase();
  const { db: withTemplate, template } = createTemplate(db, {
    name: "Default",
    overrides: TEMPLATE_OVERRIDES,
  });
  db = withTemplate;

  const cvItems: Array<{
    sectionDefinitionId: string;
    items: Array<{ elementId: string; variantId: string }>;
  }> = [];

  for (const sample of SAMPLE_ITEMS) {
    const section = db.sections.find((candidate) => candidate.key === sample.sectionKey);
    if (!section) throw new Error(`Missing standard section: ${sample.sectionKey}`);

    const created = createElement(db, {
      sectionId: section.id,
      variantName: "Example",
      fields: sample.fields,
    });
    db = created.db;
    cvItems.push({
      sectionDefinitionId: section.id,
      items: [{ elementId: created.element.id, variantId: created.variant.id }],
    });
  }

  const { db: withCv, version } = createCVProject(db, {
    name: "Example CV",
    templateId: template.id,
  });
  db = withCv;

  for (const section of cvItems) {
    db = setSectionItems(db, version.id, section.sectionDefinitionId, section.items);
  }

  return db;
}