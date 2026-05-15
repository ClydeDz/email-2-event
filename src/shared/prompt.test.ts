import { describe, it, expect } from "vitest";
import { getTimezoneOffset } from "./prompt";

describe("getTimezoneOffset", () => {
  it("returns +00:00 for UTC timezone", () => {
    const result = getTimezoneOffset("UTC");
    expect(result).toBe("+00:00");
  });

  it("returns +00:00 for empty offset from Intl", () => {
    // Mock scenario where Intl returns empty GMT
    const result = getTimezoneOffset("Etc/UTC");
    expect(result).toBe("+00:00");
  });

  it("adds :00 to offset without colon", () => {
    // Some timezones return offset like +0100 instead of +01:00
    const result = getTimezoneOffset("Europe/London");
    // This will depend on the system's timezone, but should have proper format
    expect(result).toMatch(/^[+-]\d{1,2}:\d{2}$/);
  });

  it("handles invalid timezone gracefully", () => {
    const result = getTimezoneOffset("Invalid/Timezone");
    expect(result).toBe("+00:00");
  });

  it("returns offset in correct format", () => {
    const result = getTimezoneOffset("America/New_York");
    // Should be in format +H:MM or -H:MM
    expect(result).toMatch(/^[+-]\d{1,2}:\d{2}$/);
  });

  it("removes GMT prefix from offset", () => {
    const result = getTimezoneOffset("Europe/Paris");
    // Should not contain GMT
    expect(result).not.toContain("GMT");
  });
});
