import { describe, it, expect } from "vitest";
import { ExtractionSchema, extractionJsonSchema } from "./schema";

describe("ExtractionSchema", () => {
  it("validates valid event extraction", () => {
    const result = ExtractionSchema.safeParse({
      kind: "event",
      title: "Team Meeting",
      start: "2026-05-15T14:00:00Z",
      end: "2026-05-15T15:00:00Z",
      location: "Conference Room A",
      description: "Weekly sync",
    });
    expect(result.success).toBe(true);
  });

  it("validates valid task extraction", () => {
    const result = ExtractionSchema.safeParse({
      kind: "task",
      title: "Complete report",
      due: "2026-05-15",
      description: "Q2 financial report",
    });
    expect(result.success).toBe(true);
  });

  it("requires kind field", () => {
    const result = ExtractionSchema.safeParse({
      title: "Meeting",
    });
    expect(result.success).toBe(false);
  });

  it("requires title field", () => {
    const result = ExtractionSchema.safeParse({
      kind: "event",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid kind values", () => {
    const result = ExtractionSchema.safeParse({
      kind: "invalid",
      title: "Meeting",
    });
    expect(result.success).toBe(false);
  });

  it("allows optional fields to be omitted", () => {
    const result = ExtractionSchema.safeParse({
      kind: "event",
      title: "Meeting",
    });
    expect(result.success).toBe(true);
  });

  it("validates with only required fields", () => {
    const result = ExtractionSchema.safeParse({
      kind: "task",
      title: "Task",
    });
    expect(result.success).toBe(true);
  });
});

describe("extractionJsonSchema", () => {
  it("has correct structure", () => {
    expect(extractionJsonSchema).toHaveProperty("type", "object");
    expect(extractionJsonSchema).toHaveProperty("properties");
    expect(extractionJsonSchema).toHaveProperty("required", ["kind", "title"]);
    expect(extractionJsonSchema).toHaveProperty("additionalProperties", false);
  });

  it("includes all expected properties", () => {
    const properties = extractionJsonSchema.properties;
    expect(properties).toHaveProperty("kind");
    expect(properties).toHaveProperty("title");
    expect(properties).toHaveProperty("start");
    expect(properties).toHaveProperty("end");
    expect(properties).toHaveProperty("location");
    expect(properties).toHaveProperty("due");
    expect(properties).toHaveProperty("description");
  });

  it("has correct kind enum", () => {
    expect(extractionJsonSchema.properties.kind).toHaveProperty("enum", [
      "event",
      "task",
    ]);
  });
});
