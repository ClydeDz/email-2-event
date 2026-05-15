import { describe, it, expect, vi, beforeEach } from "vitest";
import { scrapeEmail } from "./extract";

// Mock the selector functions
vi.mock("./selectors", () => ({
  findMessageSubject: vi.fn(),
  findMessageFrom: vi.fn(),
  findMessageDate: vi.fn(),
  findMessageBody: vi.fn(),
}));

import {
  findMessageSubject,
  findMessageFrom,
  findMessageDate,
  findMessageBody,
} from "./selectors";

describe("scrapeEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when both subject and body are missing", () => {
    vi.mocked(findMessageSubject).mockReturnValue("");
    vi.mocked(findMessageBody).mockReturnValue("");

    const result = scrapeEmail();
    expect(result).toBeNull();
  });

  it("returns null when body is missing", () => {
    vi.mocked(findMessageSubject).mockReturnValue("Test Subject");
    vi.mocked(findMessageBody).mockReturnValue("");

    const result = scrapeEmail();
    expect(result).toBeNull();
  });

  it("returns email data with fallbacks for missing from", () => {
    vi.mocked(findMessageSubject).mockReturnValue("Test Subject");
    vi.mocked(findMessageFrom).mockReturnValue("");
    vi.mocked(findMessageBody).mockReturnValue("Test body text");

    const result = scrapeEmail();
    expect(result).not.toBeNull();
    expect(result?.subject).toBe("Test Subject");
    expect(result?.from).toBe("Unknown sender");
    expect(result?.bodyText).toBe("Test body text");
  });

  it("returns email data with all fields present", () => {
    vi.mocked(findMessageSubject).mockReturnValue("Test Subject");
    vi.mocked(findMessageFrom).mockReturnValue("sender@example.com");
    vi.mocked(findMessageBody).mockReturnValue("Test body text");

    const result = scrapeEmail();
    expect(result).not.toBeNull();
    expect(result?.subject).toBe("Test Subject");
    expect(result?.from).toBe("sender@example.com");
    expect(result?.bodyText).toBe("Test body text");
  });

  it("truncates body text to 4000 characters", () => {
    vi.mocked(findMessageSubject).mockReturnValue("Test Subject");
    vi.mocked(findMessageBody).mockReturnValue("a".repeat(5000));

    const result = scrapeEmail();
    expect(result).not.toBeNull();
    expect(result?.bodyText).toHaveLength(4000);
  });

  it('uses "(no subject)" fallback when subject is missing', () => {
    vi.mocked(findMessageSubject).mockReturnValue("");
    vi.mocked(findMessageBody).mockReturnValue("Test body text");

    const result = scrapeEmail();
    expect(result).not.toBeNull();
    expect(result?.subject).toBe("(no subject)");
  });
});
