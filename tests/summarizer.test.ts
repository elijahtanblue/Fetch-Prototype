/**
 * Unit tests for the deterministic notes summarizer.
 *
 * Verifies sanitization, first-sentence extraction, truncation,
 * determinism, and character limits.
 */

import { sanitizeNotes, generateSummary } from "@/domain/services/summarizer";

describe("sanitizeNotes", () => {
  test("strips control characters", () => {
    expect(sanitizeNotes("hello\x00world\x07test")).toBe("hello world test");
  });

  test("normalizes whitespace", () => {
    expect(sanitizeNotes("hello   world\n\ttab")).toBe("hello world tab");
  });

  test("preserves normal text", () => {
    expect(sanitizeNotes("Normal clinical notes.")).toBe("Normal clinical notes.");
  });

  test("handles empty string", () => {
    expect(sanitizeNotes("")).toBe("");
  });

  test("handles string with only control chars", () => {
    expect(sanitizeNotes("\x00\x01\x02")).toBe("");
  });

  test("handles string with only whitespace", () => {
    expect(sanitizeNotes("   \n\t  ")).toBe("");
  });
});

describe("generateSummary", () => {
  test("returns empty string for empty input", () => {
    expect(generateSummary("")).toBe("");
  });

  test("extracts first sentence when under limit", () => {
    expect(generateSummary("Patient improved significantly. More details follow."))
      .toBe("Patient improved significantly.");
  });

  test("returns full text when short and no sentence boundary", () => {
    expect(generateSummary("Patient recovering well")).toBe("Patient recovering well");
  });

  test("truncates at word boundary for long text without sentence", () => {
    const longText = "Patient is showing signs of " + "improvement ".repeat(30);
    const summary = generateSummary(longText);
    expect(summary.endsWith("...")).toBe(true);
    expect(summary.length).toBeLessThanOrEqual(203); // 200 + "..."
  });

  test("extracts first sentence from long text", () => {
    const longText = "Patient showed improvement. " + "More details follow. ".repeat(20);
    expect(generateSummary(longText)).toBe("Patient showed improvement.");
  });

  test("is deterministic (same input produces same output)", () => {
    const input = "Patient showed improvement. Second sentence.";
    expect(generateSummary(input)).toBe(generateSummary(input));
  });

  test("caps at 200 characters", () => {
    const longWord = "A".repeat(300);
    const summary = generateSummary(longWord);
    expect(summary.length).toBeLessThanOrEqual(203); // 200 + "..."
  });

  test("sanitizes input before summarizing", () => {
    expect(generateSummary("Patient\x00 improved\x07 well.")).toBe("Patient improved well.");
  });

  test("handles sentence ending with exclamation mark", () => {
    expect(generateSummary("Urgent! Patient needs follow-up.")).toBe("Urgent!");
  });

  test("handles sentence ending with question mark", () => {
    expect(generateSummary("Is there improvement? Further assessment needed."))
      .toBe("Is there improvement?");
  });
});
