/**
 * Deterministic notes summarizer.
 *
 * Pure functions with zero external dependencies.
 * Sanitizes raw clinical notes and generates a template summary
 * using rules-based extraction (first sentence, word-boundary truncation).
 */

const MAX_SUMMARY_LENGTH = 200;

/**
 * Strip control characters and normalize whitespace.
 */
export function sanitizeNotes(raw: string): string {
  return raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generate a deterministic summary from raw clinical notes.
 *
 * Rules:
 * 1. Sanitize input
 * 2. If short enough, extract first sentence (ending with . ! or ?)
 * 3. If no sentence boundary, return full sanitized text (if short)
 * 4. For long text, extract first sentence if within limit
 * 5. Otherwise truncate at word boundary + "..."
 * 6. Cap at MAX_SUMMARY_LENGTH characters
 */
export function generateSummary(raw: string): string {
  const sanitized = sanitizeNotes(raw);
  if (sanitized.length === 0) return "";

  if (sanitized.length <= MAX_SUMMARY_LENGTH) {
    const sentenceMatch = sanitized.match(/^[^.!?]+[.!?]/);
    if (sentenceMatch) return sentenceMatch[0].trim();
    return sanitized;
  }

  // Long text: try first sentence within limit
  const sentenceMatch = sanitized.match(/^[^.!?]+[.!?]/);
  if (sentenceMatch && sentenceMatch[0].length <= MAX_SUMMARY_LENGTH) {
    return sentenceMatch[0].trim();
  }

  // Truncate at word boundary
  const truncated = sanitized.slice(0, MAX_SUMMARY_LENGTH);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > MAX_SUMMARY_LENGTH * 0.5) {
    return truncated.slice(0, lastSpace) + "...";
  }
  return truncated + "...";
}
