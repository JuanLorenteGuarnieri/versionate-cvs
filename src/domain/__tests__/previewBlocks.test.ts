import test from "node:test";
import assert from "node:assert/strict";
import type { ResolvedSection } from "../resolveCV.js";
import { computeBlockSpacing, flattenSectionsToBlocks } from "../previewBlocks.js";

function makeSection(id: string, title: string, itemCount: number, key = ""): ResolvedSection {
  return {
    sectionDefinitionId: id,
    key,
    title,
    order: 0,
    hasVisibleContent: true,
    items: Array.from({ length: itemCount }, (_, i) => ({
      elementId: `${id}-el${i}`,
      variantId: `${id}-var${i}`,
      variantName: "Original",
      fields: [],
      broken: false,
    })),
  };
}

test("flattenSectionsToBlocks produce un título seguido de sus items, en orden", () => {
  const blocks = flattenSectionsToBlocks([makeSection("s1", "Experience", 2)]);
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["section-title", "item", "item"]
  );
  assert.equal(blocks[0]!.id, "title:s1");
});

test("flattenSectionsToBlocks concatena varias secciones en orden", () => {
  const blocks = flattenSectionsToBlocks([makeSection("s1", "A", 1), makeSection("s2", "B", 1)]);
  assert.deepEqual(
    blocks.map((b) => b.sectionId),
    ["s1", "s1", "s2", "s2"]
  );
});

test("una sección sin items solo produce el bloque de título (caso borde, no debería darse en la práctica)", () => {
  const blocks = flattenSectionsToBlocks([makeSection("s1", "A", 0)]);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]!.kind, "section-title");
});

test("todos los ids de bloque son únicos", () => {
  const blocks = flattenSectionsToBlocks([makeSection("s1", "A", 3), makeSection("s2", "B", 2)]);
  const ids = blocks.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("computeBlockSpacing: itemGap entre items de la misma sección", () => {
  const blocks = flattenSectionsToBlocks([makeSection("s1", "A", 2)]);
  const spacing = computeBlockSpacing(blocks, 10, 20);
  // [título, item0, item1] -> tras título: 0, tras item0 (mismo section, hay next item): 10, tras item1 (último, sin next): 0
  assert.deepEqual(spacing, [0, 10, 0]);
});

test("computeBlockSpacing: sectionGap tras el último item antes de la siguiente sección", () => {
  const blocks = flattenSectionsToBlocks([makeSection("s1", "A", 1), makeSection("s2", "B", 1)]);
  const spacing = computeBlockSpacing(blocks, 10, 20);
  // [t1, item(s1, último de su sección) -> sectionGap, t2, item(s2, último de todos) -> 0]
  assert.deepEqual(spacing, [0, 20, 0, 0]);
});

test("computeBlockSpacing nunca pone espacio tras un título", () => {
  const blocks = flattenSectionsToBlocks([makeSection("s1", "A", 1)]);
  const spacing = computeBlockSpacing(blocks, 10, 20);
  assert.equal(spacing[0], 0);
});

test("flattenSectionsToBlocks agrupa TODOS los items de la sección 'languages' en un único bloque 'language-row' (petición explícita: una columna por idioma)", () => {
  const section = makeSection("langs", "Languages", 3, "languages");
  const blocks = flattenSectionsToBlocks([section]);
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["section-title", "language-row"]
  );
  const row = blocks[1]!;
  assert.equal(row.kind, "language-row");
  if (row.kind === "language-row") {
    assert.equal(row.items.length, 3);
    assert.equal(row.sectionId, "langs");
  }
});

test("una sección con key distinta de 'languages' sigue produciendo un bloque por item, aunque se llame igual de casualidad en el título", () => {
  const section = makeSection("s1", "Languages", 2, "custom-abc");
  const blocks = flattenSectionsToBlocks([section]);
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["section-title", "item", "item"]
  );
});
