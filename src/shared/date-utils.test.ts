import { describe, it, expect } from "vitest";
import { normalizeDateToYYYYMMDD, normalizeTaskDueDate } from "./date-utils";

describe("normalizeDateToYYYYMMDD", () => {
  it("returns empty string for undefined input", () => {
    expect(normalizeDateToYYYYMMDD(undefined)).toBe("");
  });

  it("returns YYYY-MM-DD format as-is", () => {
    expect(normalizeDateToYYYYMMDD("2026-05-11")).toBe("2026-05-11");
  });

  it("extracts date from ISO 8601 with time", () => {
    expect(normalizeDateToYYYYMMDD("2026-05-11T00:00:00Z")).toBe("2026-05-11");
    expect(normalizeDateToYYYYMMDD("2026-05-11T14:30:00.000Z")).toBe(
      "2026-05-11",
    );
  });

  it("parses human-readable date formats", () => {
    expect(normalizeDateToYYYYMMDD("May 15, 2026")).toBe("2026-05-15");
    expect(normalizeDateToYYYYMMDD("2026/05/16")).toBe("2026-05-16");
  });

  it("returns empty string for invalid dates", () => {
    expect(normalizeDateToYYYYMMDD("invalid-date")).toBe("");
    expect(normalizeDateToYYYYMMDD("not a date")).toBe("");
  });
});

describe("normalizeTaskDueDate", () => {
  it("returns empty string for non-task kinds", () => {
    expect(normalizeTaskDueDate({ kind: "event", due: "2026-05-11" })).toBe("");
  });

  it("uses due date when available", () => {
    expect(normalizeTaskDueDate({ kind: "task", due: "2026-05-11" })).toBe(
      "2026-05-11",
    );
  });

  it("falls back to start date when due is missing", () => {
    expect(normalizeTaskDueDate({ kind: "task", start: "2026-05-12" })).toBe(
      "2026-05-12",
    );
  });

  it("falls back to end date when due and start are missing", () => {
    expect(normalizeTaskDueDate({ kind: "task", end: "2026-05-13" })).toBe(
      "2026-05-13",
    );
  });

  it("prefers due over start and end", () => {
    expect(
      normalizeTaskDueDate({
        kind: "task",
        due: "2026-05-11",
        start: "2026-05-12",
        end: "2026-05-13",
      }),
    ).toBe("2026-05-11");
  });

  it("handles ISO date formats", () => {
    expect(
      normalizeTaskDueDate({ kind: "task", due: "2026-05-11T00:00:00Z" }),
    ).toBe("2026-05-11");
  });

  it("returns empty string when no date fields are present", () => {
    expect(normalizeTaskDueDate({ kind: "task" })).toBe("");
  });
});
