import test from "node:test";
import assert from "node:assert/strict";
import { resolveLinkForLine } from "../fields/linkExtraction.js";
import type { ExtractedLinkAnnotation, ExtractedTextItem } from "../types.js";
import type { Line } from "../entryGrouping.js";

function textItem(text: string, x: number, y: number, page = 1, width?: number): ExtractedTextItem {
  return { text, x, y, fontSize: 10, fontName: "f1", page, width: width ?? text.length * 5 };
}

function line(items: ExtractedTextItem[]): Line {
  return { text: items.map((i) => i.text).join(" "), y: items[0]!.y, items };
}

function link(url: string, page: number, rect: [number, number, number, number]): ExtractedLinkAnnotation {
  return { url, page, rect };
}

test("resuelve la URL cuando el rectángulo de la anotación solapa la línea", () => {
  const l = line([textItem("LinkedIn", 50, 700)]);
  const links = [link("https://linkedin.com/in/jane", 1, [48, 697, 120, 710])];
  assert.equal(resolveLinkForLine(l, links), "https://linkedin.com/in/jane");
});

test("no resuelve nada si la anotación está en otra página", () => {
  const l = line([textItem("LinkedIn", 50, 700, 1)]);
  const links = [link("https://linkedin.com/in/jane", 2, [48, 697, 120, 710])];
  assert.equal(resolveLinkForLine(l, links), null);
});

test("no resuelve nada si no hay solape en X aunque la Y coincida", () => {
  const l = line([textItem("LinkedIn", 50, 700)]);
  const links = [link("https://example.com/unrelated", 1, [400, 697, 470, 710])];
  assert.equal(resolveLinkForLine(l, links), null);
});

test("no resuelve nada si no hay solape en Y aunque la X coincida", () => {
  const l = line([textItem("LinkedIn", 50, 700)]);
  const links = [link("https://example.com/unrelated", 1, [48, 300, 120, 313])];
  assert.equal(resolveLinkForLine(l, links), null);
});

test("sin ninguna anotación de enlace, devuelve null limpiamente", () => {
  const l = line([textItem("Just plain text", 50, 700)]);
  assert.equal(resolveLinkForLine(l, []), null);
});
