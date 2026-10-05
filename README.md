# Versionate CVs

A local-first CV management application built with React, TypeScript, Vite, and IndexedDB. No backend required.

## Overview

Versionate CVs helps you create multiple CVs tailored to different job applications by reusing a personal database of content. You can store experiences, projects, education, skills, etc., once and create variants of those elements to present them in different ways. Combine elements and their variants freely to build different CVs. The final CV is a configuration of content + template + section order that can be previewed in real time and exported to PDF.

## Key Concepts

- **Database**: Stores all reusable content (personal info, profile, experience, education, projects, skills, etc.).
- **Elements and Variants**: Each section contains elements (e.g., a job position). Each element can have multiple variants (different versions of that element). A CV selects concrete elements and a specific variant for each.
- **CV Versions**: A saved CV configuration (template, selected elements/variants, section order) is a version. You can modify the current version or save changes as a new version.
- **Templates**: Define the visual style (typography, colors, spacing, section title styling, header styling, date styling, bullet styling, separators, link styling, etc.). Templates do not affect the underlying data.

## Features

- **Local-first**: All data stays in the browser (IndexedDB). No accounts, no backend, no cloud synchronization.
- **Import/Export**: Database can be exported as human-readable JSON for backups and imported later.
- **Drag-and-drop**: Reorder sections and elements within sections.
- **Rich Text Editing**: Supports bold (*text*), strong (**text**), and bullet points ("· ") in text fields.
- **PDF Export**: Uses `window.print()` on the preview DOM, ensuring the preview matches the exported PDF exactly (A4, auto-pagination).
- **PDF Import**: Extract text and layout from an existing PDF to generate a draft CV for review (does not auto-save; user must accept/modify/discard).
- **ATS Analyzer**: Local tool to check machine readability, structure, contrast, etc., and compare CV against a job description (no AI).
- **Job Matching**: Generate a CV from a pasted job description by selecting the best-matching elements/variants from your database.
- **Dark Mode**: Default theme is dark.
- **Responsive**: Designed for desktop; works on various screen sizes.
- **Testing**: Comprehensive unit tests for domain logic (run with `npm test`).

## Tech Stack

- **React 19** + **Vite** for fast development builds.
- **TypeScript** for static typing.
- **IndexedDB** via a wrapper layer for persistence.
- **@dnd-kit** for drag-and-drop interactions.
- **pdfjs-dist** for PDF text extraction (import).
- **Vitest/Node test runner**: Uses native Node test runner via `tsx` (no extra dependencies needed for tests in CI).

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run type checking
npm run typecheck

# Run tests
npm test

# Build for production
npm run build
```

The app will be available at <http://localhost:5173> (or similar).

## Project Structure

```text
src/
├── domain/             # Pure business logic (no React/IndexedDB/pdfjs imports except where needed)
│   ├── model/          # Type definitions (Section, Element, Variant, Template, CVProject, etc.)
│   ├── database.ts     # CRUD operations + business rules
│   ├── cv.ts           # CV versioning logic
│   ├── variants.ts     # Variant handling
│   ├── templates.ts    # Template management
│   ├── trash.ts, history.ts
│   ├── resolveCV.ts    # Resolve a CV version into renderable blocks
│   ├── preview.ts, previewBlocks.ts, pagination.ts, formatting.ts, richtext.ts
│   ├── pdfImport/      # PDF import pipeline (text extraction → section detection → field mapping)
│   ├── ats/            # ATS analyzer and job matching
│   └── ...             # Other domain modules (formatting, i18n, labels, etc.)
├── app/
│   ├── state/          # Application state (appStore) wrapping domain + autosave + persistence
│   └── ui/             # React components
│       ├── components/ # Dashboard, CVComposer (CV editor), TemplateEditor, etc.
│       └── ...         # Other UI components (preview, viewport, etc.)
└── persistence/        # IndexedDB wrapper, JSON serialization, migrations, autosave, beforeunload guard
```

## Architectural Notes

- **Domain is pure and immutable**: Functions receive an `AppDatabase` and return a new instance or throw if invalid. State and persistence layers are thin wrappers.
- **Stable ID references**: CVs reference elements/variants by ID; updating a variant in the database reflects in all CVs using it unless you explicitly fork (“Save as variant”).
- **Flexible styling bags**: Objects like `Template.sectionTitleStyle`, `headerStyle`, `dateStyle`, `bulletStyle`, `separators`, `linkStyle` are `Record<string, unknown>` to allow adding style keys without schema migrations. The renderer documents which keys it consumes (see JSDoc in `model/types.ts`). `typography` and `spacing` are strict interfaces.
- **Format migrations**: Changes to the shape of `Template` etc. that would break existing IndexedDB data or JSON backups require an entry in `src/persistence/migrations.ts` and an increment of `CURRENT_FORMAT_VERSION`. Test migrations against real backups, not just empty databases.
- **Preview ≈ PDF**: `CVPreview.tsx` is the sole renderer; `window.print()` prints the same DOM. The `@media print` CSS hides everything except `.cv-preview` via `visibility:hidden` plus an absolute overlay. Any new ancestor with `overflow`/fixed height (like `PreviewViewport`) needs its own print reset, otherwise pages may be missing or blank.

## How to Contribute

Feel free to open issues or submit pull requests. Please ensure new domain logic is covered by tests.

## License

MIT
