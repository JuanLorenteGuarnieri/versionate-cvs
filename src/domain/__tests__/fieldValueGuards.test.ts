import test from "node:test";
import assert from "node:assert/strict";
import { isDateRangeValue, isLinkListValue, isRichTextDoc, isStringListValue } from "../fieldValueGuards.js";

test("isRichTextDoc detecta un RichTextDoc real", () => {
  assert.equal(isRichTextDoc({ type: "richtext", blocks: [] }), true);
});
test("isRichTextDoc rechaza null, arrays, DateRangeValue y primitivos", () => {
  assert.equal(isRichTextDoc(null), false);
  assert.equal(isRichTextDoc(["a", "b"]), false);
  assert.equal(isRichTextDoc({ start: "2020-01-01" }), false);
  assert.equal(isRichTextDoc("texto"), false);
  assert.equal(isRichTextDoc(true), false);
});

test("isDateRangeValue detecta un DateRangeValue real, incluso vacío", () => {
  assert.equal(isDateRangeValue({ start: "2020-01-01", end: "2021-01-01" }), true);
  assert.equal(isDateRangeValue({}), true);
});
test("isDateRangeValue rechaza null, arrays, RichTextDoc y primitivos", () => {
  assert.equal(isDateRangeValue(null), false);
  assert.equal(isDateRangeValue(["a"]), false);
  assert.equal(isDateRangeValue({ type: "richtext", blocks: [] }), false);
  assert.equal(isDateRangeValue("texto"), false);
  assert.equal(isDateRangeValue(false), false);
});

test("isStringListValue detecta un array de strings no vacío", () => {
  assert.equal(isStringListValue(["Python", "MATLAB"]), true);
});
test("isStringListValue rechaza LinkListEntry[], vacío y no-arrays", () => {
  assert.equal(isStringListValue([{ label: "LinkedIn", url: "https://linkedin.com" }]), false);
  assert.equal(isStringListValue([]), false);
  assert.equal(isStringListValue(null), false);
  assert.equal(isStringListValue("texto"), false);
});

test("isLinkListValue detecta un array de LinkListEntry no vacío", () => {
  assert.equal(isLinkListValue([{ label: "LinkedIn", url: "https://linkedin.com" }]), true);
});
test("isLinkListValue rechaza string[], vacío y no-arrays", () => {
  assert.equal(isLinkListValue(["Python"]), false);
  assert.equal(isLinkListValue([]), false);
  assert.equal(isLinkListValue(null), false);
});
