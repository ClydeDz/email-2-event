/**
 * All Gmail DOM selectors in named functions.
 * Returns null if not found — never throws.
 * Gmail's DOM is unofficial and can change — isolating selectors here
 * makes it easy to fix when Google updates their UI.
 *
 * Logging discipline: pass `warn = true` only when the caller *expected* to
 * find an element (e.g. a button was clicked, the probe was run). During
 * background scans (MutationObserver polling) pass `warn = false` so the
 * extensions error panel stays clean when the user is on the inbox list.
 */

const PREFIX = '[gmail-ext-selectors]';

export function findOpenMessageContainer(warn = false): Element | null {
  // Gmail marks the open email thread view with role="main".
  // We need to detect that an email is actually expanded, not just the list view.
  // Key signal: the message body container (.a3s) is only present when an email is open.
  const candidates = [
    // Primary: expanded message body — present in both full-view and reading-pane
    document.querySelector('.a3s.aiL'),
    document.querySelector('.a3s'),
    // Full-view thread: the ii.gt wrapper exists only when a message is expanded
    document.querySelector('[role="main"] .ii.gt'),
    // data-message-id is on the individual message row in a thread
    document.querySelector('[data-message-id]'),
  ];

  for (const el of candidates) {
    if (el) return el;
  }

  if (warn) console.warn(PREFIX, 'findOpenMessageContainer: no open message found');
  return null;
}

export function findMessageToolbar(warn = false): Element | null {
  // Gmail's per-message toolbar contains Reply, Forward, etc.
  // We try many selector strategies because Gmail's class names change frequently.
  // aria-label attributes are the most stable — they're tied to accessibility and
  // change less often than obfuscated class names.

  // Strategy 1: find via aria-label on known action buttons, walk up to toolbar ancestor
  const ariaTargets = [
    '[aria-label="Reply"]',
    '[aria-label="Forward"]',
    '[aria-label="Reply all"]',
    '[data-tooltip="Reply"]',
    '[data-tooltip="Forward"]',
    '[title="Reply"]',
    '[title="Forward"]',
  ];

  for (const selector of ariaTargets) {
    const btn = document.querySelector(selector);
    if (!btn) continue;

    // Walk up looking for role="toolbar" or a div that acts as one
    let el: Element | null = btn;
    while (el && el !== document.body) {
      if (el.getAttribute('role') === 'toolbar') return el;
      // Gmail sometimes wraps actions in a div without role="toolbar"
      // Detect by: contains >1 interactive button/span sibling and is inside [role="main"]
      const parent = el.parentElement;
      if (parent && parent.closest('[role="main"]')) {
        const interactiveCount = parent.querySelectorAll(
          '[aria-label], [data-tooltip], [title="Reply"], [title="Forward"]'
        ).length;
        if (interactiveCount >= 2) return parent;
      }
      el = el.parentElement;
    }
  }

  // Strategy 2: known Gmail class names (change over time, but worth trying)
  const classTargets = [
    '[role="main"] [role="toolbar"]',
    '.ade',          // bottom action bar
    '.amn',          // reply/forward wrapper
    '.bAq',          // another known action row
  ];

  for (const selector of classTargets) {
    const el = document.querySelector(selector);
    if (el) return el;
  }

  // Strategy 3: fallback — find any toolbar-like container within the open message
  const messageBody = document.querySelector('.a3s.aiL, .a3s, [role="main"] .ii.gt');
  if (messageBody) {
    // Walk up to the message wrapper, then look for a sibling/cousin that has buttons
    let ancestor = messageBody.parentElement;
    for (let depth = 0; depth < 10 && ancestor; depth++) {
      const toolbar = ancestor.querySelector('[role="toolbar"]');
      if (toolbar) return toolbar;
      ancestor = ancestor.parentElement;
    }
  }

  if (warn) console.warn(PREFIX, 'findMessageToolbar: toolbar not found — selectors need updating');
  return null;
}

export function findMessageSubject(): string {
  const candidates = [
    document.querySelector('h2.hP'),
    document.querySelector('[data-thread-perm-id] h2'),
    document.querySelector('[role="main"] h2'),
    document.querySelector('.ha h2'),
  ];

  for (const el of candidates) {
    if (el?.textContent?.trim()) {
      return el.textContent.trim();
    }
  }

  // Fallback: read from the page title
  const titleMatch = document.title.match(/^(.+?) - /);
  if (titleMatch) return titleMatch[1];

  console.warn(PREFIX, 'findMessageSubject: subject not found');
  return '';
}

export function findMessageFrom(): string {
  // The sender is in a span with email attribute or data-hovercard-id
  const candidates = [
    document.querySelector('[email][data-hovercard-id]'),
    document.querySelector('.gD[email]'),
    document.querySelector('[data-message-id] .gD'),
    document.querySelector('.go span[email]'),
  ];

  for (const el of candidates) {
    if (el) {
      const name = el.textContent?.trim() ?? '';
      const email = el.getAttribute('email') ?? '';
      if (name && email) return `${name} <${email}>`;
      if (email) return email;
      if (name) return name;
    }
  }

  console.warn(PREFIX, 'findMessageFrom: sender not found');
  return '';
}

export function findMessageDate(warn = false): string {
  // The email date/time is in a span with title attribute containing the full datetime
  const candidates = [
    document.querySelector('.g3.an span[title]'),
    document.querySelector('[data-message-id] span[title]'),
    document.querySelector('.gH .g3 span[title]'),
    document.querySelector('span.g3'),
  ];

  for (const el of candidates) {
    const title = el?.getAttribute('title');
    if (title?.trim()) return title.trim();
    if (el?.textContent?.trim()) return el.textContent.trim();
  }

  if (warn) console.warn(PREFIX, 'findMessageDate: date not found');
  return new Date().toISOString();
}

export function findMessageBody(warn = false): string {
  // The message body is in a div with dir="ltr" inside the open message
  const candidates = [
    // Primary Gmail message body container
    document.querySelector('.a3s.aiL'),
    document.querySelector('.a3s'),
    document.querySelector('[role="main"] div[dir="ltr"]'),
    // Quote-stripped content
    document.querySelector('.ii.gt div[dir="ltr"]'),
    document.querySelector('.ii.gt'),
  ];

  for (const el of candidates) {
    const text = el?.textContent?.trim();
    if (text && text.length > 10) {
      return text;
    }
  }

  if (warn) console.warn(PREFIX, 'findMessageBody: body not found');
  return '';
}
