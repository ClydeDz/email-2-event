import {
  findOpenMessageContainer,
  findMessageToolbar,
  findMessageSubject,
  findMessageFrom,
  findMessageDate,
  findMessageBody,
} from "./selectors";
import { scrapeEmail } from "./extract";
import { runExtraction } from "./llm";
import { showReviewModal } from "./review-modal";
import type { Extraction } from "../shared/schema";
import type { TaskList } from "../shared/types";
import { featureFlags } from "../shared/config";

const BUTTONS_ATTR = "data-gmail-ext-injected";
const SIGN_IN_POPUP_ID = "gmail-ext-signin-popup";

// ─────────────────────────────────────────────
// Utility: send a message to the service worker
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Toast notification (DOM, not shadow)
// ─────────────────────────────────────────────
function showToast(message: string, type: "success" | "error" | "info"): void {
  const existing = document.getElementById("gmail-ext-toast");
  existing?.remove();

  const toast = document.createElement("div");
  toast.id = "gmail-ext-toast";

  const colors = {
    success: { bg: "#e9fbf0", text: "#066b3b", border: "#a3e6c5" },
    error: { bg: "#fef2f2", text: "#991b1b", border: "#fca5a5" },
    info: { bg: "#f0efff", text: "#3d35b8", border: "#c7c4ff" },
  }[type];

  Object.assign(toast.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: "2147483647",
    padding: "10px 16px",
    borderRadius: "6px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: "13px",
    fontWeight: "500",
    boxShadow: "0 4px 6px rgba(0,0,0,.07), 0 10px 20px rgba(0,0,0,.1)",
    background: colors.bg,
    color: colors.text,
    border: `1px solid ${colors.border}`,
    transition: "opacity 300ms",
  });

  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─────────────────────────────────────────────
// Sign-in popup near a button
// ─────────────────────────────────────────────
function showSignInPopup(anchorEl: HTMLElement): void {
  document.getElementById(SIGN_IN_POPUP_ID)?.remove();

  const popup = document.createElement("div");
  popup.id = SIGN_IN_POPUP_ID;

  Object.assign(popup.style, {
    position: "absolute",
    zIndex: "2147483646",
    background: "#fff",
    border: "1px solid #e3e8ee",
    borderRadius: "8px",
    boxShadow: "0 4px 6px rgba(0,0,0,.07), 0 10px 20px rgba(0,0,0,.1)",
    padding: "12px 16px",
    width: "240px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: "13px",
    color: "#0a2540",
  });

  // Find a scrollable container within the email content to append the popup to
  const scrollContainer = anchorEl.closest('[role="main"]') || document.body;
  scrollContainer.appendChild(popup);

  const rect = anchorEl.getBoundingClientRect();
  const containerRect = scrollContainer.getBoundingClientRect();

  popup.style.top = `${rect.bottom - containerRect.top + 6}px`;
  popup.style.left = `${rect.left - containerRect.left - 240}px`;

  const msg = document.createElement("p");
  msg.style.marginBottom = "10px";
  msg.style.lineHeight = "1.4";
  msg.textContent = "Sign in with Google to create Tasks.";

  const signInBtn = document.createElement("button");
  Object.assign(signInBtn.style, {
    display: "block",
    width: "100%",
    padding: "7px 12px",
    background: "#635bff",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
  });
  signInBtn.textContent = "Sign in with Google";

  signInBtn.addEventListener("click", async () => {
    signInBtn.disabled = true;
    signInBtn.textContent = "Signing in…";
    try {
      await sendMessage({ type: "SIGN_IN" });
      popup.remove();
      showToast('Signed in! Click "✓ Create task" again.', "success");
    } catch (err) {
      signInBtn.disabled = false;
      signInBtn.textContent = "Sign in with Google";
      showToast(`Sign-in failed: ${(err as Error).message}`, "error");
    }
  });

  popup.appendChild(msg);
  popup.appendChild(signInBtn);

  // Dismiss on outside click
  const dismiss = (e: MouseEvent): void => {
    if (!popup.contains(e.target as Node) && e.target !== anchorEl) {
      popup.remove();
      document.removeEventListener("click", dismiss);
    }
  };
  setTimeout(() => document.addEventListener("click", dismiss), 0);
}

// ─────────────────────────────────────────────
// Button injection
// ─────────────────────────────────────────────
// Design tokens (mirrors src/shared/tokens.css — inlined here because the
// content script runs in Gmail's DOM, not an extension page, so we can't
// import a CSS file directly without a shadow DOM).
// ─────────────────────────────────────────────
const DS = {
  accent: "#635bff",
  accentHover: "#5046e5",
  accentActive: "#4338ca",
  textOnAccent: "#ffffff",
  border: "#e3e8ee",
  radius: "6px",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  shadow: "0 1px 1px rgba(0,0,0,.03), 0 2px 6px rgba(0,0,0,.08)",
  shadowHover: "0 1px 3px rgba(0,0,0,.06), 0 4px 12px rgba(0,0,0,.12)",
  ease: "cubic-bezier(.4,0,.2,1)",
};

function applyBaseButtonStyles(btn: HTMLButtonElement): void {
  Object.assign(btn.style, {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    // Match dashboard .btn exactly: padding: 8px 16px, font-size: 14px
    padding: "8px 16px",
    marginLeft: "6px",
    background: DS.accent,
    color: DS.textOnAccent,
    border: "none",
    // Stripe inner-highlight signature
    boxShadow: `${DS.shadow}, inset 0 1px 0 rgba(255,255,255,.12)`,
    borderRadius: DS.radius,
    fontFamily: DS.fontFamily,
    fontSize: "14px",
    fontWeight: "500",
    letterSpacing: "0.01em",
    lineHeight: "1",
    cursor: "pointer",
    whiteSpace: "nowrap",
    verticalAlign: "middle",
    textDecoration: "none",
    outline: "none",
    transition: `background 150ms ${DS.ease}, box-shadow 150ms ${DS.ease}, transform 80ms ${DS.ease}`,
    // Reset Gmail styles that may bleed in
    textTransform: "none",
    appearance: "none",
    WebkitAppearance: "none",
    boxSizing: "border-box",
  });
}

// Lucide-style plus icon (1.5px stroke, 14×14 — matches the dashboard icon spec)
const PLUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0;display:block"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

// Check icon for the task button
const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0;display:block"><polyline points="20 6 9 17 4 12"/></svg>`;

function setButtonContent(btn: HTMLButtonElement, label: string): void {
  btn.innerHTML = "";
  const isEvent = label.includes("event");
  const isTask = label.includes("task");

  if (isEvent) {
    const iconWrap = document.createElement("span");
    iconWrap.style.display = "contents";
    iconWrap.innerHTML = PLUS_SVG;
    btn.appendChild(iconWrap);
  } else if (isTask) {
    const iconWrap = document.createElement("span");
    iconWrap.style.display = "contents";
    iconWrap.innerHTML = CHECK_SVG;
    btn.appendChild(iconWrap);
  }

  const text = document.createElement("span");
  // Strip the leading "+ " or "✓ " text prefix — icon handles it
  text.textContent = label.replace(/^[+✓]\s*/, "");
  btn.appendChild(text);
}

function createButton(label: string): HTMLButtonElement {
  const btn = document.createElement("button");
  applyBaseButtonStyles(btn);
  setButtonContent(btn, label);

  btn.addEventListener("mouseenter", () => {
    if (btn.disabled) return;
    btn.style.background = DS.accentHover;
    btn.style.boxShadow = `${DS.shadowHover}, inset 0 1px 0 rgba(255,255,255,.12)`;
  });
  btn.addEventListener("mouseleave", () => {
    if (btn.disabled) return;
    btn.style.background = DS.accent;
    btn.style.boxShadow = `${DS.shadow}, inset 0 1px 0 rgba(255,255,255,.12)`;
  });
  btn.addEventListener("mousedown", () => {
    if (btn.disabled) return;
    btn.style.background = DS.accentActive;
    btn.style.transform = "translateY(1px)";
  });
  btn.addEventListener("mouseup", () => {
    btn.style.transform = "translateY(0)";
  });

  // Focus ring — visible on keyboard nav, consistent with the extension
  btn.addEventListener("focus", () => {
    btn.style.outline = `2px solid ${DS.accent}`;
    btn.style.outlineOffset = "2px";
  });
  btn.addEventListener("blur", () => {
    btn.style.outline = "none";
  });

  return btn;
}

// Spinner element shown inside the button while loading
function createSpinner(): HTMLSpanElement {
  const spinner = document.createElement("span");
  spinner.setAttribute("aria-hidden", "true");
  Object.assign(spinner.style, {
    display: "inline-block",
    width: "11px",
    height: "11px",
    border: "1.5px solid rgba(255,255,255,.4)",
    borderTopColor: "#ffffff",
    borderRadius: "50%",
    animation: "gmail-ext-spin 0.65s linear infinite",
    flexShrink: "0",
  });
  return spinner;
}

// Inject the keyframe animation once
(function injectSpinnerKeyframes() {
  if (document.getElementById("gmail-ext-keyframes")) return;
  const style = document.createElement("style");
  style.id = "gmail-ext-keyframes";
  style.textContent =
    "@keyframes gmail-ext-spin { to { transform: rotate(360deg); } }";
  document.head.appendChild(style);
})();

function setButtonLoading(
  btn: HTMLButtonElement,
  loading: boolean,
  originalLabel: string,
): void {
  btn.disabled = loading;
  if (loading) {
    btn.innerHTML = "";
    btn.appendChild(createSpinner());
    const text = document.createElement("span");
    text.textContent = "Working…";
    btn.appendChild(text);
    btn.style.opacity = "0.85";
    btn.style.cursor = "wait";
    btn.style.background = DS.accentHover;
  } else {
    // Restore icon + label (not just textContent, which would drop the SVG)
    setButtonContent(btn, originalLabel);
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
    btn.style.background = DS.accent;
    btn.style.boxShadow = `${DS.shadow}, inset 0 1px 0 rgba(255,255,255,.12)`;
  }
}

function injectButtons(): void {
  // warn=true here because we already confirmed a message container exists —
  // a missing toolbar at this point is a genuine selector failure worth knowing.
  const toolbar = findMessageToolbar(true);
  if (!toolbar) {
    console.warn("[gmail.ts] Cannot inject buttons: toolbar not found");
    return;
  }

  // Avoid double-injection
  if (toolbar.querySelector(`[${BUTTONS_ATTR}]`)) return;

  const wrapper = document.createElement("span");
  wrapper.setAttribute(BUTTONS_ATTR, "true");
  wrapper.style.display = "inline-flex";
  wrapper.style.alignItems = "center";

  const EVENT_LABEL = "+ Create event";
  const TASK_LABEL = "✓ Create task";

  // ── Create event button ──
  const eventBtn = createButton(EVENT_LABEL);
  eventBtn.title = "Extract this email into a Google Calendar event";

  eventBtn.addEventListener("click", async () => {
    setButtonLoading(eventBtn, true, EVENT_LABEL);
    try {
      const emailData = scrapeEmail();

      if (!emailData) {
        showToast("Could not read this email. Please try again.", "error");
        return;
      }

      showToast(
        "Extracting event details… this may take a few moments.",
        "info",
      );

      const extraction: Extraction = await runExtraction(emailData, "event");

      await sendMessage({ type: "OPEN_CALENDAR", payload: extraction });
    } catch (err) {
      const msg = (err as Error).message ?? "Unknown error";
      showToast(`Failed to create event: ${msg}`, "error");
      console.error("[gmail.ts] Create event error:", err);
    } finally {
      setButtonLoading(eventBtn, false, EVENT_LABEL);
    }
  });

  // ── Create task button ──
  const taskBtn = createButton(TASK_LABEL);
  taskBtn.title = "Extract this email into a Google Task";

  taskBtn.addEventListener("click", async () => {
    setButtonLoading(taskBtn, true, TASK_LABEL);
    try {
      // Check sign-in state
      const { profile } = await sendMessage<{ profile: unknown }>({
        type: "GET_PROFILE",
      });

      if (!profile) {
        setButtonLoading(taskBtn, false, TASK_LABEL);
        showSignInPopup(taskBtn);
        return;
      }

      const emailData = scrapeEmail();

      if (!emailData) {
        showToast("Could not read this email. Please try again.", "error");
        setButtonLoading(taskBtn, false, TASK_LABEL);
        return;
      }

      showToast(
        "Extracting task details… this may take a few moments.",
        "info",
      );
      const extraction: Extraction = await runExtraction(emailData, "task");

      // Get task lists
      let taskLists: TaskList[] = [];
      try {
        const result = await sendMessage<{ taskLists: TaskList[] }>({
          type: "GET_TASK_LISTS",
        });
        taskLists = result.taskLists ?? [];
      } catch {
        // Non-fatal — modal will use @default
      }

      setButtonLoading(taskBtn, false, TASK_LABEL);

      // Show the review modal
      await showReviewModal(extraction, taskLists);
    } catch (err) {
      const msg = (err as Error).message ?? "Unknown error";
      showToast(`Failed to create task: ${msg}`, "error");
      console.error("[gmail.ts] Create task error:", err);
      setButtonLoading(taskBtn, false, TASK_LABEL);
    }
  });

  wrapper.appendChild(eventBtn);

  // Only add task button if task creation is enabled
  if (featureFlags.enableTaskCreation) {
    wrapper.appendChild(taskBtn);
  }

  toolbar.appendChild(wrapper);
}

// ─────────────────────────────────────────────
// MutationObserver + URL-change detection
// ─────────────────────────────────────────────
let lastUrl = location.href;
let injectTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Schedule an injection attempt.
 *
 * Gmail mutates its DOM constantly (polling, counters, animations). A naive
 * debounce that resets on every mutation will NEVER fire. Instead:
 *
 * - `forceReset = true` (used on URL/navigation change): cancel any pending
 *   timer and start a fresh one — we want to re-scan after a navigation.
 * - `forceReset = false` (default, used on content mutations): only schedule
 *   if no timer is already pending. This lets the first detection win and
 *   prevents Gmail's constant background mutations from pushing the timer out.
 */
function scheduleInject(forceReset = false): void {
  if (injectTimeout) {
    if (!forceReset) return; // already scheduled — let it fire
    clearTimeout(injectTimeout);
  }
  injectTimeout = setTimeout(() => {
    injectTimeout = null;
    if (findOpenMessageContainer()) {
      injectButtons();
    }
  }, 400);
}

// Watch for DOM changes (Gmail is a SPA)
const observer = new MutationObserver(() => {
  const currentUrl = location.href;

  if (currentUrl !== lastUrl) {
    // Navigation — reset the timer so we re-scan for the new view
    lastUrl = currentUrl;
    scheduleInject(true);
    return;
  }

  // No URL change (reading pane, or in-thread expansion).
  // Only schedule if buttons aren't already injected and there's no pending timer.
  // Pass warn=false — false-negatives here are expected (inbox list has no open email).
  if (injectTimeout) return;

  const container = findOpenMessageContainer(false);
  if (container) {
    const toolbar = findMessageToolbar(false);
    if (toolbar && !toolbar.querySelector(`[${BUTTONS_ATTR}]`)) {
      scheduleInject(false);
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Initial check (page may already have an email open on load)
scheduleInject(true);

// ─────────────────────────────────────────────
// Message listener for diagnostics (from dashboard)
// ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SELECTOR_PROBE") {
    // warn=true so a probe failure shows up in the console as an actionable signal
    const results = {
      openMessageContainer: !!findOpenMessageContainer(true),
      toolbar: !!findMessageToolbar(true),
      subject: findMessageSubject() || null,
      from: findMessageFrom() || null,
      bodyLength: findMessageBody(true)?.length ?? 0,
    };
    sendResponse(results);
    return false;
  }

  if (message.type === "TEST_EXTRACTION") {
    const { subject, from, bodyText, intent } = message.payload as {
      subject: string;
      from: string;
      bodyText: string;
      intent: "event" | "task";
    };
    runExtraction({ subject, from, bodyText }, intent)
      .then((result) => sendResponse({ ok: true, extraction: result }))
      .catch((err) =>
        sendResponse({ ok: false, error: (err as Error).message }),
      );
    return true; // async
  }

  return false;
});
