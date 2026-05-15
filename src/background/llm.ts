/**
 * LLM extraction — runs in the background service worker.
 *
 * The LanguageModel global (Chrome built-in AI / Gemini Nano) is available in
 * extension service workers and extension pages, but NOT in content scripts
 * (isolated world). Moving the call here means email text stays local — there
 * is no network request — while the API is actually accessible.
 */

import { buildSystemPrompt } from "../shared/prompt";
import { ExtractionSchema, extractionJsonSchema } from "../shared/schema";
import type { Extraction } from "../shared/schema";
import type { EmailData } from "../content/extract";

// Declare the global Chrome provides in service-worker context (Chrome 138+)
declare const LanguageModel: {
  availability(options?: {
    expectedOutputLanguages?: string[];
  }): Promise<string>;
  create(options: {
    systemPrompt?: string;
    initialPrompts?: Array<{ role: string; content: string }>;
    expectedOutputLanguages?: string[];
    monitor?: (monitor: EventTarget) => void;
  }): Promise<{
    prompt(
      input: string,
      options?: { responseConstraint?: unknown },
    ): Promise<string>;
    destroy(): void;
  }>;
};

export async function checkAvailability(): Promise<string> {
  if (typeof LanguageModel === "undefined") return "unavailable";
  try {
    return await LanguageModel.availability({
      expectedOutputLanguages: ["en"],
    });
  } catch {
    return "unavailable";
  }
}

export async function runExtraction(
  emailData: EmailData,
  intent: "event" | "task",
): Promise<Extraction> {
  if (typeof LanguageModel === "undefined") {
    throw new Error(
      "Chrome built-in AI is not available in this browser. " +
        "Make sure you are using Chrome 138+ with the Prompt API enabled.",
    );
  }

  const availability = await LanguageModel.availability({
    expectedOutputLanguages: ["en"],
  });

  if (availability === "unavailable") {
    throw new Error(
      "Gemini Nano is not supported on this device. " +
        "Compatible hardware (≥4 GB VRAM or capable integrated GPU) and Chrome 138+ are required.",
    );
  }

  if (availability === "downloadable") {
    throw new Error(
      "Gemini Nano has not been downloaded yet. " +
        'Open the extension dashboard and click "Download AI model" first.',
    );
  }

  // Fetch user's timezone preference from storage, fall back to system timezone
  const storage = await chrome.storage.local.get("defaults");
  const userTimezone = storage.defaults?.timezone;

  const systemPrompt = buildSystemPrompt(intent, userTimezone);

  // expectedOutputLanguages silences Chrome's "No output language specified" console warning.
  // We use systemPrompt (string) rather than initialPrompts (array) — the string form is
  // more stable across Chrome versions and avoids the role-array format differences.
  const session = await LanguageModel.create({
    systemPrompt,
    expectedOutputLanguages: ["en"],
  });

  try {
    const userMessage = [
      `Subject: ${emailData.subject}`,
      `From: ${emailData.from}`,
      "",
      emailData.bodyText,
    ].join("\n");

    const raw = await session.prompt(userMessage, {
      responseConstraint: extractionJsonSchema,
    });

    const parsed = JSON.parse(
      typeof raw === "string" ? raw : JSON.stringify(raw),
    );

    // Force kind to match the button the user clicked
    return ExtractionSchema.parse({ ...parsed, kind: intent });
  } finally {
    session.destroy();
  }
}
