# Gmail → Google Calendar / Tasks (Chrome Extension)

A Chrome extension that adds two actions to an open Gmail message — **Create event in Google Calendar** and **Create task in Google Tasks** — uses Chrome's built-in on-device LLM (Gemini Nano) to extract the key fields from the email, and pre-populates Google's native create dialog so the user just clicks Save.

Public extension, distributed via the Chrome Web Store. Works with any Google account, including free `@gmail.com`.

---

## 1. Feasibility report

### Verdict

**Feasible** as a Chrome MV3 extension with Chrome's built-in AI as the only LLM in v1. Two real risks: (a) Gmail's DOM is unofficial and can break when Google updates it, and (b) Gemini Nano is hardware-gated, so not every user qualifies. Both have mitigations described below.

### Why a Chrome extension, not a Workspace Add-on

A Google Workspace Add-on would work on free personal Gmail accounts (once published publicly on the Workspace Marketplace) and could read the currently-open email via a contextual trigger. **But** it runs in Google's server-side Apps Script sandbox and therefore **cannot call Chrome's built-in Gemini Nano** — that API only exists in the user's browser. An Add-on would also be confined to a right-hand sidebar card (no inline toolbar button).

Since on-device Gemini Nano is the v1 priority, a Chrome extension is the right surface. A Workspace Add-on remains a _future_ option for reaching mobile Gmail (where extensions don't run) — likely paired with a cloud LLM at that point.

### Capability-by-capability assessment

| Requirement                                              | Feasible?        | Mechanism                                                                                                                                                                   | Risk                                                                                                                                                                                 |
| -------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Add buttons to each open Gmail email                     | ✅               | MV3 content script injects buttons into Gmail's message toolbar DOM                                                                                                         | Medium — Gmail DOM is unstable; selectors can break. Mitigated by a thin selector-abstraction layer and a fallback path via the extension popup.                                     |
| Read the email body                                      | ✅               | Content script reads the message DOM in the active thread                                                                                                                   | Low                                                                                                                                                                                  |
| Understand/parse content (dates, amounts, flights, etc.) | ✅               | LLM call with JSON-schema-constrained output                                                                                                                                | Low for clear emails; Nano is a small model so quality on long/ambiguous emails will be the main thing to validate                                                                   |
| Use Chrome's bundled **Gemini Nano** (on-device)         | ⚠️ Conditionally | Chrome built-in **Prompt API** (`LanguageModel`), available to extensions on Chrome 138+                                                                                    | Hardware-gated (≥4 GB VRAM or capable iGPU, desktop only); model downloads on first use (~2 GB). Must feature-detect and show a clear "not available on this device" state in v1.    |
| Pre-fill Google Calendar's native create dialog          | ✅               | Open `https://calendar.google.com/calendar/render?action=TEMPLATE&text=…&dates=…&details=…&location=…` in a new tab — user clicks Save                                      | Low. No OAuth needed for this path.                                                                                                                                                  |
| Pre-fill Google Tasks before saving                      | ⚠️               | No public template URL exists for Tasks. v1 uses an in-page **review modal** with editable pre-filled fields; on Save it calls Tasks API v1 `tasks.insert` (OAuth required) | Low — same UX (user clicks Save), but implementation is API-backed rather than URL-backed                                                                                            |
| Google OAuth (for the Tasks path + profile)              | ✅               | `chrome.identity.getAuthToken` with `openid profile email tasks`                                                                                                            | Low. Calendar path needs no OAuth in v1 because we use the template URL.                                                                                                             |
| Public distribution / any Google account                 | ✅               | Chrome Web Store listing; Google OAuth consent screen set to **External / In production**                                                                                   | The `tasks` scope is non-sensitive, so OAuth verification is lightweight (mainly brand review). `profile`/`email` are basic scopes. Calendar template URL avoids any Calendar scope. |
| Reading the email itself                                 | ✅               | Content script DOM read in the user's open Gmail tab — **not** a Gmail API call                                                                                             | None. **No Gmail OAuth scope is requested.** This is a key privacy point.                                                                                                            |

### Notable constraints to flag now

1. **"Context menu" wording.** Two interpretations:
   - **In-Gmail toolbar buttons** on the open email — what this plan assumes.
   - **Chrome's native right-click menu** via `chrome.contextMenus` — also possible as an _additional_ entry point that triggers the same flow. Cheap to add later.

2. **Gmail DOM is not a public API.** The injected buttons can break when Google ships a Gmail UI update. Mitigations: isolate selectors in one module, log when they fail, and provide a fallback "act on currently open email" button in the extension popup.

3. **Built-in AI availability.** On qualifying machines, `LanguageModel.availability()` returns `"available"` or `"downloadable"`. On the rest it returns `"unavailable"`. v1 behaviour when unavailable: surface a clear empty state in the UI ("Your device doesn't support on-device AI yet"). No silent fallback in v1.

4. **Tasks vs Events for "invoice".** A Google Task has a `due` _date_ (no time) and `notes` — perfect for "pay £450 by 30 May". A Calendar event needs start/end times. The two buttons let the user pick the target; the LLM's job is just field extraction, not classification.

5. **Privacy.** Email content stays on-device in v1 (Gemini Nano is local). The privacy policy will say so explicitly — a strong differentiator for a public extension.

### LLM strategy

**v1: Chrome built-in AI (Gemini Nano) only.** Free, on-device, private, no network call for inference. Feature-detected via `await LanguageModel.availability()`.

**v1.1 (later, deferred):**

- **Local Ollama** on `localhost:11434` — auto-detected if running; requires `OLLAMA_ORIGINS=chrome-extension://*` for CORS.
- **BYO API key** (Anthropic / OpenAI / Gemini) — stored in `chrome.storage.local` (not `sync`, to avoid syncing secrets).

A hosted "extension's own API key" tier is out of scope: it would require a paid backend and is not aligned with the privacy story.

---

## 2. Technical plan (v1)

### Architecture

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│ Content script (Gmail)      │        │ Background service worker     │
│  - Detects open email       │  msg   │  - Routes "create" intents    │
│  - Injects toolbar buttons  ├───────►│  - Calls Calendar template URL│
│  - Extracts email DOM       │        │    via chrome.tabs.create     │
│  - Calls LanguageModel API  │◄───────┤  - OAuth + Tasks API (modal)  │
│  - Shows in-page review     │ result │                               │
│    modal (Tasks path)       │        │                               │
└─────────────────────────────┘        └──────────────────────────────┘
                │
                ▼
       ┌─────────────────────┐
       │ Built-in AI         │
       │ LanguageModel       │
       │ (Gemini Nano, local)│
       └─────────────────────┘
```

The LLM call runs inside the **content script** so the email text never crosses an extension message boundary or hits the network. The background worker only handles OAuth + Tasks API.

### File layout

```
/manifest.json
/src
  /background
    service-worker.ts          // OAuth, Tasks API, Calendar URL builder
    google/
      auth.ts                  // chrome.identity (openid/profile/email/tasks)
      userinfo.ts              // /oauth2/v3/userinfo → cached profile
      tasks.ts                 // tasks.insert, lists/@me/lists
      calendar-url.ts          // builds calendar render?action=TEMPLATE URL
    install.ts                 // chrome.runtime.onInstalled → open landing
  /content
    gmail.ts                   // selector module + button injector
    extract.ts                 // pulls subject, from, body from the DOM
    llm.ts                     // LanguageModel session + JSON schema
    review-modal.ts            // pre-filled, editable modal for Tasks path
  /landing
    dashboard.html             // full-tab dashboard (onboarding tiles + settings)
    dashboard.ts
    dashboard.css              // imports shared design tokens
    components/                // top bar, onboarding tiles, settings cards, diagnostics
  /shared
    schema.ts                  // Zod schemas for extracted event/task
    prompt.ts                  // structured extraction prompt
/icons
```

### Manifest (MV3, key bits)

```jsonc
{
  "manifest_version": 3,
  "name": "Email 2 Event",
  "version": "0.1.0",
  "permissions": ["storage", "identity", "scripting", "tabs"],
  "host_permissions": [
    "https://mail.google.com/*",
    "https://www.googleapis.com/*",
    "https://calendar.google.com/*",
  ],
  "background": { "service_worker": "src/background/service-worker.js" },
  "content_scripts": [
    {
      "matches": ["https://mail.google.com/*"],
      "js": ["src/content/gmail.js"],
      "run_at": "document_idle",
    },
  ],
  "options_page": "src/landing/dashboard.html",
  "action": { "default_title": "Email 2 Event" },
  "oauth2": {
    "client_id": "<YOUR_OAUTH_CLIENT_ID>.apps.googleusercontent.com",
    "scopes": [
      "openid",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/tasks",
    ],
  },
  "minimum_chrome_version": "138",
}
```

Note: `calendar.events` scope is **not** requested in v1 because we use Calendar's public template URL. This keeps the OAuth verification surface small.

### Gmail integration (content script)

1. `MutationObserver` on `body` watches for Gmail navigating into a message-open view.
2. When detected, locate the per-message toolbar and inject two buttons.
3. On click: scrape `{subject, from, to, date, bodyText}` from the message DOM, then run the LLM extraction in-process.

**Selector resilience:** every DOM selector lives in `content/gmail.ts` behind a named function (`findMessageToolbar`, `findMessageBody`, …). If any returns null, log a structured warning and surface a fallback "Use currently open email" button in the extension popup.

### LLM extraction (Gemini Nano)

One call per click, JSON-schema-constrained:

```ts
type Extraction = {
  kind: "event" | "task"; // hinted by which button was clicked
  title: string;
  // Event fields:
  start?: string; // ISO 8601 with timezone
  end?: string; // ISO 8601 with timezone
  location?: string;
  // Task fields:
  due?: string; // YYYY-MM-DD (Tasks API: date only)
  // Shared:
  description?: string; // include amount, invoice #, vendor, links
};
```

Built-in API call shape (Chrome ≥138):

```ts
const session = await LanguageModel.create({
  initialPrompts: [{ role: "system", content: SYSTEM_PROMPT }],
  expectedInputs: [{ type: "text", languages: ["en"] }],
});
const json = await session.prompt(emailText, {
  responseConstraint: extractionJsonSchema,
});
```

The system prompt:

- States today's date and the user's timezone (read from `Intl.DateTimeFormat().resolvedOptions().timeZone`).
- Tells the model which button was clicked and to fill the matching fields.
- Lists examples for invoice, flight, hotel, meeting confirmation, and "no clear date" (return best-effort title only).

### Review-and-confirm UX (per your requirement)

Two slightly different shapes, same principle: the user always clicks the final Save button.

**Calendar path (event button):**

1. Build the URL: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=<title>&dates=<startUTC>/<endUTC>&details=<description>&location=<location>`.
2. `chrome.tabs.create({ url })` — Google Calendar opens its native event-creation screen with everything pre-filled. The user reviews and clicks **Save**.
3. No OAuth needed for this path.

**Tasks path (task button):**

1. Show an in-page modal (injected by the content script) with editable fields: title, due date, notes, target list.
2. The modal mimics the Google Tasks create UI but is ours.
3. On Save, send to background worker → `chrome.identity.getAuthToken` → `POST tasks/v1/lists/@default/tasks`.
4. Show a toast with a link to the created task.

If we discover later that a hidden `tasks.google.com/embed?...` parameter set works for prefill, we can drop the custom modal — but the API-backed modal is the safe v1.

### OAuth & identity

**What we actually need a Google sign-in for:**

- Showing the user's name + avatar on the landing page (`openid profile email`).
- Creating tasks (`tasks` scope).
- Nothing else. Gmail reading is DOM-only, and Calendar event creation uses the public template URL.

**One-time consent flow:**

- The landing page has a "Connect Google" button.
- Click triggers `chrome.identity.getAuthToken({ interactive: true })` requesting **all four scopes at once** (`openid`, `profile`, `email`, `tasks`). One consent screen, done.
- After consent, the background worker:
  1. Fetches `https://www.googleapis.com/oauth2/v3/userinfo` with the token → caches `{ name, email, picture }` in `chrome.storage.local`.
  2. Optionally fetches `tasks/v1/users/@me/lists` to populate the default-list selector.
- 401 handling: `chrome.identity.removeCachedAuthToken` → re-auth.

**Sign-out:** a button on the landing page calls `chrome.identity.removeCachedAuthToken` and clears the cached profile. The next Tasks click will re-prompt.

**Sign-in is optional in v1.** Forcing OAuth for features that don't need it would (a) hurt install conversion, (b) raise eyebrows for privacy-aware users, and (c) risk OAuth verification rejection on the "minimum scope" principle — Google reviewers expect requested scopes to map to immediately-used features.

How the two states behave:

- **Signed out (first-class state):**
  - Calendar (event) button works fully.
  - Task button shows a sign-in prompt inline on first click ("Connect Google to enable Tasks").
  - Landing page shows the Connect CTA prominently but is otherwise functional.
- **Signed in:**
  - Both buttons work.
  - Landing page personalised with avatar + name.
  - Default Tasks list selector populated.

The Connect CTA on the landing page is sold on the **Tasks feature**, not on personalisation. Personalisation is a nice side-effect, not the reason to sign in.

### Design language (Stripe-inspired)

All visual surfaces — landing page, in-page review modal, sign-in prompts — follow Stripe's design vocabulary. Codified here so it's consistent across components and reviewable in PRs.

**Typography**

- Family: `Inter`, fall back to system stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", …`).
- Headlines: weight 600, tight letter-spacing (`-0.01em` to `-0.02em`).
- Body: weight 400, line-height 1.55.
- Numerics: tabular figures (`font-variant-numeric: tabular-nums`) for amounts, dates, IDs.
- Monospace: `"SF Mono", Menlo, Consolas, monospace` for keys, IDs, code samples — rendered in pill chips with subtle background.

**Colour**

- Background: `#ffffff` page, `#f6f9fc` for inset / muted regions.
- Text: primary `#0a2540`, secondary `#425466`, tertiary `#697386`. **No pure black.**
- Accent: `#635bff` (Stripe indigo) for primary actions and focus rings. One accent only — avoid rainbow UIs.
- Borders / dividers: `#e3e8ee`.
- Semantic: success `#0e9f6e`, warning `#d97706`, error `#df1b41`. Used sparingly, only on status surfaces.

**Spacing**

- 8-pt base grid. Card padding `24–32 px`. Section spacing `48–64 px`. Generous vertical rhythm — Stripe's UI breathes.

**Shape**

- Card corner radius `12 px`. Buttons / inputs `6 px`. Pills `999 px`.
- Borders are `1 px solid #e3e8ee` — never heavier.

**Elevation**

- Cards float on soft, low-spread, multi-layer shadows:
  - Resting: `0 1px 1px rgba(0,0,0,.03), 0 2px 6px rgba(0,0,0,.05)`.
  - Hover: shifts up one tier, never dramatic.
- No drop shadows on flat surfaces inside a card.

**Buttons**

- **Primary:** filled `#635bff`, white text, subtle 1 px inner highlight at the top, `font-weight: 500`. Only one primary per card.
- **Secondary:** white background, `#0a2540` text, `1 px` border.
- **Ghost:** transparent, used for low-stakes actions ("Sign out", "Cancel").
- Disabled state: `opacity: 0.5`, `cursor: not-allowed`, no hover effect.

**Form controls**

- Inputs: `1 px` border, `6 px` radius, `12 px` vertical padding, focus state shows `2 px` outline in accent colour with `2 px` offset (not a glow).
- Labels above inputs, `13 px`, weight 500, `#425466`.
- Helper / error text below in `12 px`.

**Status pills**

- `999 px` radius, `4 px 10 px` padding, `12 px` text, weight 500.
- Tinted background + matching darker text: e.g. `bg:#e9fbf0 text:#066b3b` for success.

**Motion**

- Default transition: `150 ms cubic-bezier(.4,0,.2,1)`.
- Hover lifts shadow + brightens by ~4%.
- Modals: fade + 8 px Y translate, 180 ms.
- No bouncy / spring easings.

**Iconography**

- Phosphor or Lucide icon set, 1.5 px stroke, `16 px` or `20 px` sizes. Consistent stroke weight everywhere.

**Implementation notes**

- Use plain CSS with custom properties (CSS variables) keyed to the tokens above — no Tailwind in v1, no heavyweight component library. Stripe's clarity comes from restraint, and restraint is easier without a framework pushing defaults.
- Tokens live in `src/landing/landing.css` `:root` and are imported by any other surface (the review modal in the content script imports the same token CSS into its shadow DOM).
- Single Inter `woff2` self-hosted from the extension package — no Google Fonts CDN (privacy + offline).

### Dashboard

The extension's home is a **dashboard**, not a marketing landing page. It's the user's control surface — onboarding progress at the top, settings below. Sign-in is a step in the onboarding sequence, not a hero ask.

**When the user sees it:**

- **Automatically on first install:** `chrome.runtime.onInstalled` with `reason === 'install'` opens it via `chrome.tabs.create`.
- **Anytime:** clicking the extension toolbar icon (`chrome.action`) opens it. Also wired as `options_page` so it's reachable from `chrome://extensions`.

Full-tab layout — room for tiles, settings, and diagnostics without crowding.

**Top bar (persistent across the page):**

- Left: extension wordmark.
- Right: **identity chip.**
  - **Signed out:** a neutral, anonymous avatar glyph (greyscale, generic silhouette in a circle) followed by a quiet text link "Sign in with Google." Low visual weight — present, not pushy.
  - **Signed in:** user's Google avatar + first name. Click opens a small popover with full email and a "Sign out" link.

**1. Onboarding tiles (top section)**

A row of tiles representing the things the user can try, in the order they'd naturally do them. Each tile has a small icon, a one-line title, a sentence of supporting copy, and a state indicator (todo / done). Tiles persist their done-state in `chrome.storage.local` so progress survives reloads.

Tiles in v1 (left to right):

1. **Create an event from Gmail** _(available immediately, no sign-in)_
   - Body: "Open any email in Gmail and click _Create event_ in the toolbar."
   - Action: "Open Gmail" button → `chrome.tabs.create({ url: 'https://mail.google.com/' })`.
   - Marked done the first time the user successfully completes the Calendar flow (signalled from the content script).

2. **Sign in with Google** _(unlocks the Tasks tile)_
   - Body: "Connect your account to create Google Tasks from emails."
   - Action: "Sign in" button → same OAuth flow as the top-bar link (one consent screen for `openid profile email tasks`).
   - Marked done once `chrome.storage.local` has a cached profile.
   - **Locked tile below (Tasks)** shows a subtle padlock until this one is done.

3. **Create a task from Gmail** _(gated on tile 2)_
   - Body: "Try the Tasks button on an invoice or reminder email."
   - Action: "Open Gmail" (same as tile 1).
   - Marked done after first successful task save.

Optional fourth tile, only shown when relevant:

4. **Enable on-device AI** _(only rendered when `LanguageModel.availability() === "downloadable"`)_
   - Body: "Download Gemini Nano (~2 GB) so extraction runs privately on this device."
   - Action: "Download model" → triggers `LanguageModel.create({ monitor })`; the tile shows a progress bar inline.
   - Hidden when state is `available` (no action needed) or `unavailable` (can't act). Replaced with a one-line warning banner above the tiles when `unavailable`.

**Tile visual treatment (per the Stripe design language):**

- Card: white, 12 px radius, resting shadow, 24 px padding.
- 16 px icon (Phosphor / Lucide), accent colour for active, `#697386` for completed.
- Title 15 px / 600, body 13 px / 400 in `#425466`.
- State chip top-right: `Done` (green pill) when complete, otherwise no chip.
- Gated tiles render at `opacity: 0.6` with a small padlock icon and a tooltip pointing to the prerequisite tile.
- Hover lifts shadow one tier (150 ms).

**2. On-device AI status (compact card)**

Now smaller and informational — the _action_ lives in tile 4 when needed. This card just shows the current state:

- `available` → green pill "Gemini Nano ready" + last-checked timestamp.
- `downloading` → progress bar mirroring the tile.
- `unavailable` → amber pill with reason and link to Chrome's requirements.

**3. Defaults (settings card)**

- Default Tasks list (populated after auth via `tasks/v1/users/@me/lists`; greyed out when signed out).
- Default event duration when the email has no end time (15 / 30 / 60 min).
- Timezone — auto-detected, override available.

**4. Privacy & data (info card)**
Plain-English: "Email content is read from the open Gmail tab and processed by Chrome's on-device AI. Nothing is sent to any server. Your Google account is only used to create Tasks you explicitly save." Link to full privacy policy.

**5. Diagnostics (collapsed by default)**

- Built-in AI availability raw value.
- Gmail selector probe.
- "Test extraction" textarea — paste an email body, see the extracted JSON.

**Footer**
Version, GitHub link, support email.

**State management:**

- Settings + onboarding progress in `chrome.storage.local`.
- Dashboard subscribes to `chrome.storage.onChanged` and to `LanguageModel` availability changes so tiles + cards update live (e.g. when sign-in happens in another tab or a model download finishes).
- A `dashboardState` shape captures everything: `{ profile?, completedTiles: string[], defaults, aiStatus }`.

**File additions:**

```
/src/landing
  dashboard.html
  dashboard.ts         // mounts the UI, subscribes to storage + LanguageModel
  dashboard.css        // imports shared design tokens
  components/
    top-bar.ts         // wordmark + identity chip
    onboarding-tiles.ts
    tile.ts            // single tile, gated/done states
    ai-status-card.ts
    defaults-card.ts
    privacy-card.ts
    diagnostics-card.ts
```

`options_page` in the manifest points to `src/landing/dashboard.html`.

### Testing strategy

- **Unit:** schema validation; deterministic prompt fixtures (mock `LanguageModel` with canned outputs) covering invoice, flight, hotel, meeting, vague email.
- **Manual on-device:** the same fixtures sent to a real Gmail test account on a Chrome instance with Nano installed. This is the primary quality bar for v1.
- **Selector probe:** an internal command that runs all Gmail selectors against the current page and reports pass/fail — quick way to catch Gmail UI regressions.

### Build & ship

- TypeScript + `vite` with `@crxjs/vite-plugin`.
- Load unpacked during dev; package `.zip` for Chrome Web Store.
- OAuth client of type "Chrome Extension" tied to the published extension ID.
- Privacy policy (required for Web Store): explicitly states email content stays on-device and is processed by Chrome's built-in AI; Tasks scope is used only to create tasks the user explicitly saves.

### Milestones (v1)

1. **Spike (1–2 days):** content script injects buttons into an open Gmail email; click logs scraped email body.
2. **Calendar template URL path (½ day):** wire the event button end-to-end — extraction + `chrome.tabs.create` of the template URL.
3. **Built-in AI extraction (1–2 days):** `LanguageModel` session, JSON schema, system prompt, fixtures.
4. **Tasks path: OAuth + review modal + `tasks.insert` (1–2 days).**
5. **Dashboard (2–3 days):** top bar with anonymous/signed-in identity chip; onboarding tiles (Create event, Sign in, Create task, optional Download model) with persisted done-state and gating; AI status, defaults, privacy, diagnostics, "Test extraction" textarea. Wired as `options_page` and auto-opened on install.
6. **Selector resilience + popup fallback (½ day).**
7. **Privacy policy, store listing, OAuth verification submission (1–2 days, then wait for Google review).**

Total: ~2 working weeks of build, plus Google OAuth verification wait time.

### v1.1 (deferred, noted only)

- **Ollama** auto-detect on `localhost:11434` with model selector.
- **BYO API key** for Anthropic / OpenAI / Gemini with per-provider settings.
- **Tier auto-select** logic with explicit user override in settings.
- Optional **`chrome.contextMenus`** right-click entry as a second entry point.
- Investigate a **Workspace Add-on companion** for mobile Gmail (would use a cloud LLM).

### Open questions

1. **OAuth verification:** are you ready to publish under your own name and submit the Tasks scope for Google review? (Verification is the main thing between "works for me" and "works for the public.")
2. **Hardware floor:** comfortable with v1 simply not running on machines without Gemini Nano? Or do you want a one-paragraph BYO-key escape hatch in v1 even though full multi-tier lands in v1.1?
3. **Calendar via API later?** v1 uses the template URL (no scope). If users start asking for features the template URL can't express (recurring events, attendees, specific calendar other than primary), we'd add the `calendar.events` scope in v1.1.
