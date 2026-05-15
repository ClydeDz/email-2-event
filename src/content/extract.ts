import {
  findMessageSubject,
  findMessageFrom,
  findMessageBody,
} from "./selectors";

export interface EmailData {
  subject: string;
  from: string;
  bodyText: string;
}

export function scrapeEmail(): EmailData | null {
  // pass warn=true — scrapeEmail is only called on button click, so failures are real
  const subject = findMessageSubject();
  const from = findMessageFrom();
  const bodyText = findMessageBody(true);

  // subject and bodyText are critical; from has a fallback
  if (!subject && !bodyText) {
    console.warn("[extract] Failed to scrape email: missing subject and body");
    return null;
  }

  if (!bodyText) {
    console.warn("[extract] Failed to scrape email: missing body text");
    return null;
  }

  return {
    subject: subject || "(no subject)",
    from: from || "Unknown sender",
    // Truncate to avoid overwhelming the LLM context window
    bodyText: bodyText.slice(0, 4000),
  };
}
