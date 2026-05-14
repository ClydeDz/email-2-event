/**
 * LLM bridge for the content script.
 *
 * The LanguageModel (Gemini Nano) API is available in the extension's service
 * worker, but NOT in content scripts (isolated world). This module delegates
 * all extraction work to the background service worker via message passing.
 * Email text never leaves the device — the background worker calls the local
 * on-device model with no network request.
 */

import type { Extraction } from '../shared/schema';
import type { EmailData } from './extract';

function sendMessage<T>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response as T);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

export async function checkAvailability(): Promise<string> {
  try {
    const response = await sendMessage<{ status: string }>({
      type: 'CHECK_AI_AVAILABILITY',
    });
    return response.status;
  } catch {
    return 'unavailable';
  }
}

export async function runExtraction(
  emailData: EmailData,
  intent: 'event' | 'task'
): Promise<Extraction> {
  const response = await sendMessage<{ extraction: Extraction }>({
    type: 'RUN_EXTRACTION',
    payload: { emailData, intent },
  });
  return response.extraction;
}
