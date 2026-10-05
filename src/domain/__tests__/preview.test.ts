import test from "node:test";
import assert from "node:assert/strict";
import type { ResolvedField } from "../resolveCV.js";
import { buildItemLayout, buildProjectLayout, buildSkillsLayout } from "../preview.js";

function field(overrides: Partial<ResolvedField>): ResolvedField {
  return { key: "k", label: "L", type: "text", value: null, ...overrides };
}

test("un campo de texto se convierte en título; el segundo, en subtítulo", () => {
  const layout = buildItemLayout([
    field({ key: "title", label: "Título", type: "text", value: "Scanpath Prediction" }),
    field({ key: "company", label: "Empresa", type: "text", value: "Acme" }),
  ]);
  assert.equal(layout.title, "Scanpath Prediction");
  assert.equal(layout.subtitle, "Acme");
});

test("campos de texto vacíos no se usan como título/subtítulo", () => {
  const layout = buildItemLayout([
    field({ type: "text", value: "" }),
    field({ type: "text", value: "   " }),
    field({ type: "text", value: "Real" }),
  ]);
  assert.equal(layout.title, "Real");
  assert.equal(layout.subtitle, null);
});

test("un tercer campo de texto va a 'meta', no reemplaza el subtítulo", () => {
  const layout = buildItemLayout([
    field({ label: "Título", type: "text", value: "A" }),
    field({ label: "Subtítulo", type: "text", value: "B" }),
    field({ label: "Notas", type: "text", value: "Algo suelto" }),
  ]);
  assert.deepEqual(layout.meta, [{ label: "Notas", value: "Algo suelto", href: null }]);
});

test("un campo de texto llamado/etiquetado como ubicación va a 'locationText', no a 'meta' (se pinta aparte, debajo de la fecha)", () => {
  const layout = buildItemLayout([
    field({ label: "Título", type: "text", value: "A" }),
    field({ label: "Subtítulo", type: "text", value: "B" }),
    field({ key: "location", label: "Location", type: "text", value: "Madrid" }),
    field({ key: "extra", label: "Notas", type: "text", value: "Algo más" }),
  ]);
  assert.equal(layout.locationText, "Madrid");
  assert.deepEqual(layout.meta, [{ label: "Notas", value: "Algo más", href: null }]);
});

test("un campo 'url' cuenta como candidato a título pero nunca a subtítulo, y lleva href", () => {
  const layout = buildItemLayout([
    field({ label: "Sitio", type: "url", value: "https://example.com" }),
    field({ label: "Extra", type: "url", value: "https://example.com/2" }),
  ]);
  assert.equal(layout.title, "https://example.com");
  assert.equal(layout.titleHref, "https://example.com");
  assert.equal(layout.subtitle, null, "una url no debe ocupar el hueco del subtítulo");
  assert.deepEqual(layout.meta, [{ label: "Extra", value: "https://example.com/2", href: "https://example.com/2" }]);
});

test("daterange y date se combinan en una sola línea de fechas", () => {
  const layout = buildItemLayout([
    field({ label: "Fechas", type: "daterange", value: { start: "2020-01-01", end: "2021-01-01" } }),
    field({ label: "Fecha suelta", type: "date", value: "2022-05-01" }),
  ]);
  assert.ok(layout.dateRangeText?.includes("2020"));
  assert.ok(layout.dateRangeText?.includes("2022"));
  assert.ok(layout.dateRangeText?.includes("·"), "debe combinar ambas con un separador");
});

test("richtext se pasa tal cual; longtext se convierte a richtext de un párrafo", () => {
  const richDoc = { type: "richtext" as const, blocks: [{ kind: "paragraph" as const, runs: [{ text: "Hola" }] }] };
  const layout = buildItemLayout([
    field({ type: "richtext", value: richDoc }),
    field({ type: "longtext", value: "Texto plano" }),
  ]);
  assert.equal(layout.descriptions.length, 2);
  assert.equal(layout.descriptions[0], richDoc);
  assert.equal(layout.descriptions[1]!.blocks[0]!.runs[0]!.text, "Texto plano");
});

test("tags y list se acumulan como filas separadas de etiquetas", () => {
  const layout = buildItemLayout([
    field({ type: "tags", value: ["Python", "PyTorch"] }),
    field({ type: "list", value: ["React", "Vite"] }),
    field({ type: "tags", value: [] }), // vacío: no debe añadir una fila vacía
  ]);
  assert.deepEqual(layout.tags, [
    [
      { text: "Python", href: null },
      { text: "PyTorch", href: null },
    ],
    [
      { text: "React", href: null },
      { text: "Vite", href: null },
    ],
  ]);
});

test("un campo 'list'/'tags' normal (p.ej. Technologies) nunca se enlaza aunque un valor parezca un dominio", () => {
  // "Node.js" tiene forma de dominio (palabra.palabra) sin serlo — por eso
  // NO se adivina por la forma del valor, solo por el nombre/etiqueta del
  // campo (ver el siguiente test).
  const layout = buildItemLayout([field({ key: "technologies", label: "Technologies", type: "tags", value: ["Node.js", "React"] })]);
  assert.deepEqual(layout.tags, [
    [
      { text: "Node.js", href: null },
      { text: "React", href: null },
    ],
  ]);
});

test("un campo 'list' cuyo nombre/etiqueta habla de enlaces sí se enlaza (compatibilidad hacia atrás con 'links' como list)", () => {
  const layout = buildItemLayout([
    field({ key: "links", label: "Links (portfolio, GitHub, LinkedIn...)", type: "list", value: ["linkedin.com/in/juanlore", "github.com/juan"] }),
  ]);
  assert.deepEqual(layout.tags, [
    [
      { text: "linkedin.com/in/juanlore", href: "https://linkedin.com/in/juanlore" },
      { text: "github.com/juan", href: "https://github.com/juan" },
    ],
  ]);
});

test("un campo 'linklist' se convierte en una fila de etiquetas con label visible y href real", () => {
  const layout = buildItemLayout([
    field({
      type: "linklist",
      value: [
        { label: "LinkedIn", url: "linkedin.com/in/juanlore" },
        { label: "", url: "https://juanlorenteguarnieri.github.io/portfolio/" },
      ],
    }),
  ]);
  assert.deepEqual(layout.tags, [
    [
      { text: "LinkedIn", href: "https://linkedin.com/in/juanlore" },
      // Sin nombre puesto: se adivina uno del dominio en vez de mostrar la
      // URL entera (justo lo que pedía el usuario: "que no se lea la URL").
      // "github.io" contiene "github", así que se reconoce igual que GitHub.
      { text: "GitHub", href: "https://juanlorenteguarnieri.github.io/portfolio/" },
    ],
  ]);
});

test("un campo 'linklist' con nombre y URL vacíos sin más se descarta (sin fila vacía)", () => {
  const layout = buildItemLayout([field({ type: "linklist", value: [{ label: "", url: "" }] })]);
  assert.deepEqual(layout.tags, []);
});

test("boolean solo aparece en meta cuando es true; select vacío se ignora", () => {
  const layout = buildItemLayout([
    field({ label: "Remoto", type: "boolean", value: true }),
    field({ label: "Presencial", type: "boolean", value: false }),
    field({ label: "Nivel", type: "select", value: "" }),
  ]);
  assert.deepEqual(layout.meta, [{ label: "Remoto", value: "Sí", href: null }]);
});

test("una lista de campos vacía da un layout completamente vacío", () => {
  const layout = buildItemLayout([]);
  assert.deepEqual(layout, {
    title: null,
    titleHref: null,
    subtitle: null,
    dateRangeText: null,
    locationText: null,
    descriptions: [],
    tags: [],
    meta: [],
  });
});

test("dateLocale cambia el idioma del mes en las fechas (opción, no la template)", () => {
  const fields = [field({ key: "dateRange", label: "Dates", type: "daterange", value: { start: "2020-06-01", end: "2021-06-01" } })];
  const es = buildItemLayout(fields, { dateLocale: "es-ES" });
  const en = buildItemLayout(fields, { dateLocale: "en-US" });
  assert.notEqual(es.dateRangeText, en.dateRangeText);
});

test("lang traduce 'Actualidad'/'Present' según el idioma para un rango de fechas en curso", () => {
  const fields = [field({ key: "dateRange", label: "Dates", type: "daterange", value: { start: "2020-06-01", current: true } })];
  const es = buildItemLayout(fields, { lang: "es" });
  const en = buildItemLayout(fields, { lang: "en" });
  assert.ok(es.dateRangeText?.includes("Actualidad"));
  assert.ok(en.dateRangeText?.includes("Present"));
});

test("lang traduce las etiquetas de 'meta' SOLO si coinciden con un valor por defecto conocido", () => {
  const fields = [
    field({ key: "title", label: "Título", type: "text", value: "A" }),
    field({ key: "subtitle", label: "Subtítulo", type: "text", value: "B" }),
    field({ key: "level", label: "Level", type: "select", value: "Advanced" }),
    field({ key: "custom", label: "Mi Campo Personalizado", type: "select", value: "X" }),
  ];
  const layout = buildItemLayout(fields, { lang: "es" });
  assert.deepEqual(layout.meta, [
    { label: "Nivel", value: "Advanced", href: null },
    { label: "Mi Campo Personalizado", value: "X", href: null },
  ]);
});

// ---------- buildProjectLayout (sección "Projects", sin fecha, con subtítulo+enlaces) ----------

test("buildProjectLayout: título, subtítulo, enlaces y tecnologías se separan en campos distintos (sin fecha)", () => {
  const layout = buildProjectLayout([
    field({ key: "title", label: "Title", type: "text", value: "Scanpath Prediction" }),
    field({ key: "subtitle", label: "Subtitle", type: "text", value: "Proyecto de investigación" }),
    field({ key: "description", label: "Description", type: "richtext", value: { type: "richtext", blocks: [] } }),
    field({ key: "technologies", label: "Technologies", type: "tags", value: ["Python", "PyTorch"] }),
    field({
      key: "url",
      label: "Links",
      type: "linklist",
      value: [
        { label: "Demo", url: "https://demo.example.com" },
        { label: "", url: "https://github.com/x/y" },
      ],
    }),
  ]);
  assert.equal(layout.title, "Scanpath Prediction");
  assert.equal(layout.subtitle, "Proyecto de investigación");
  // ProjectLayout no tiene ningún concepto de fecha en absoluto (a
  // diferencia de ItemLayout) — ni siquiera existe la propiedad.
  assert.equal("dateRangeText" in layout, false);
  assert.deepEqual(
    layout.technologyTags.map((t) => t.text),
    ["Python", "PyTorch"]
  );
  // Las tecnologías nunca llevan href (se siguen viendo como píldora, no como enlace).
  assert.ok(layout.technologyTags.every((t) => t.href === null));
  assert.equal(layout.links.length, 2);
  assert.equal(layout.links[0]!.text, "Demo");
  assert.equal(layout.links[0]!.href, "https://demo.example.com");
  // Enlace sin nombre: se adivina uno a partir del dominio (no se deja caer en la URL entera).
  assert.equal(layout.links[1]!.text, "GitHub");
});

test("buildProjectLayout: un campo de fecha en los datos (residual de antes de la migración) se ignora por completo", () => {
  const layout = buildProjectLayout([
    field({ key: "title", label: "Title", type: "text", value: "Proyecto" }),
    field({ key: "dateRange", label: "Dates", type: "daterange", value: { start: "2020-01-01", end: "2021-01-01" } }),
  ]);
  assert.equal(layout.title, "Proyecto");
  assert.equal("dateRangeText" in layout, false);
});

// ---------- buildSkillsLayout (sección "Skills" fusionada) ----------

test("buildSkillsLayout: una línea por cada campo de etiquetas no vacío, en texto plano", () => {
  const groups = buildSkillsLayout(
    [
      field({ key: "programmingLanguages", label: "Programming Languages", type: "tags", value: ["C++", "Python"] }),
      field({ key: "technologies", label: "Technologies", type: "tags", value: ["OpenCV", "PyTorch"] }),
      field({ key: "softSkills", label: "Soft Skills", type: "tags", value: [] }),
    ],
    "es"
  );
  assert.deepEqual(groups, [
    { label: "Lenguajes de programación", values: ["C++", "Python"] },
    { label: "Tecnologías", values: ["OpenCV", "PyTorch"] },
  ]);
});

test("buildSkillsLayout: si los 3 campos están vacíos, no produce ninguna línea", () => {
  const groups = buildSkillsLayout([
    field({ key: "programmingLanguages", label: "Programming Languages", type: "tags", value: [] }),
    field({ key: "technologies", label: "Technologies", type: "tags", value: null }),
    field({ key: "softSkills", label: "Soft Skills", type: "tags", value: [] }),
  ]);
  assert.deepEqual(groups, []);
});
