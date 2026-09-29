import assert from "node:assert/strict";
import { test } from "node:test";
import { detectExplicitSectionCount, formatDeliveredProse, formatIntoParagraphs, hasPlanningLeak } from "./longFormWriting";

test("rejects numbered planning paragraphs and future-section instructions", () => {
  assert.equal(hasPlanningLeak("Section 1:\n\nParagraph 4 (Derive Step 4): Present evidence.", 1), true);
  assert.equal(hasPlanningLeak("Section 1:\n\nA normal paragraph.\n\nSection 2 must now examine failures.", 1), true);
  assert.equal(hasPlanningLeak("Section 1:\n\nA normal paragraph.\n\nSection 2: Wrong heading", 1), true);
  assert.equal(hasPlanningLeak("Section 1:\n\nThe idea. Derive Step 4: Add data.", 1), true);
  assert.equal(hasPlanningLeak("Section 1:\n\nThe idea. Paragraph 4 (Derive Step 4): Add data.", 1), true);
  assert.equal(hasPlanningLeak("Section 1:\n\nA normal paragraph.\n\nAnother normal paragraph.", 1), false);
});

test("formats finished prose with blank lines and without numbering paragraphs", () => {
  const formatted = formatIntoParagraphs("Section 1:\n\nA claim follows. It supports a conclusion.\n\nA second unnumbered paragraph follows.");
  assert.match(formatted, /^Section 1:\n\nA claim follows\./);
  assert.match(formatted, /conclusion\.\n\nA second unnumbered paragraph/);
  assert.doesNotMatch(formatted, /Paragraph \d/i);
});

test("hides automatically generated section headings while keeping prose separated", () => {
  const formatted = formatDeliveredProse("Section 1: Introduction\n\nOpening argument.\n\nSection 2: Second movement\n\nNext argument.", true);
  assert.equal(formatted, "Opening argument.\n\nNext argument.");
  assert.equal(formatDeliveredProse("Chapter 1:\n\nOpening argument.", false), "Chapter 1:\n\nOpening argument.");
  assert.equal(formatDeliveredProse("Section 1: Introduction\n\nOpening argument.", false), "Section 1: Introduction\n\nOpening argument.");
  assert.equal(detectExplicitSectionCount("Write 2 sections. Section 1: Begin. Section 2: Finish."), 2);
  assert.equal(detectExplicitSectionCount("Revise the uploaded paper to 20,000 words."), null);
});