/**
 * Parses various date formats and returns YYYY-MM-DD for use in date inputs.
 * Handles:
 * - ISO 8601: "2026-05-11T00:00:00Z" or "2026-05-11"
 * - Human readable: "Thursday 14 May 2026 5pm"
 * - Partial formats
 */
export function normalizeDateToYYYYMMDD(dateStr: string | undefined): string {
  if (!dateStr) return '';

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // ISO 8601 with time (extract date portion)
  if (/^\d{4}-\d{2}-\d{2}T/.test(dateStr)) {
    return dateStr.split('T')[0];
  }

  // Try parsing with Date constructor
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fall through to return empty
  }

  return '';
}

/**
 * For tasks, the LLM sometimes returns `start` or `end` instead of `due`.
 * This normalizes the extraction to ensure `due` is populated for task intents.
 */
export function normalizeTaskDueDate(extraction: {
  kind: string;
  due?: string;
  start?: string;
  end?: string;
}): string {
  if (extraction.kind !== 'task') return '';

  // Prefer due, fall back to start, then end
  const rawDate = extraction.due || extraction.start || extraction.end;
  return normalizeDateToYYYYMMDD(rawDate);
}
