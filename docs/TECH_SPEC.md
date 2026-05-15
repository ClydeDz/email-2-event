# Tech Stack

## Platform

- **Chrome Extension** (Manifest V3)
- **Minimum Chrome Version**: 138 (required for Chrome AI API)
- **Target**: Public Chrome Web Store distribution

## Language & Build

- **Language**: TypeScript 5.4.0
- **Target**: ES2022
- **Module System**: ESNext with Bundler resolution
- **Build Tool**: Vite 5.2.0
- **Extension Plugin**: @crxjs/vite-plugin 2.0.0-beta.23
- **Type Checking**: TypeScript strict mode enabled

## Runtime Architecture

### Background Service Worker

- **File**: `src/background/service-worker.ts`
- **Responsibilities**:
  - OAuth flow management via `chrome.identity`
  - Google Tasks API integration
  - Calendar template URL construction
  - Message routing between content scripts and dashboard
  - Installation handling (opens dashboard on first install)

### Content Scripts

- **Target**: Gmail (`https://mail.google.com/*`)
- **Entry Point**: `src/content/gmail.ts`
- **Responsibilities**:
  - Gmail DOM observation via `MutationObserver`
  - Toolbar button injection
  - Email content extraction (subject, from, to, date, body)
  - On-device AI extraction via Chrome's `LanguageModel` API
  - Review modal rendering for Tasks path
- **CSS**: `src/content/modal.css` (web-accessible resource)

### Dashboard (Options Page)

- **Entry Point**: `src/landing/dashboard.html`
- **Script**: `src/landing/dashboard.ts`
- **Styling**: `src/landing/dashboard.css` with shared design tokens
- **Components**:
  - Top bar with identity chip
  - Onboarding tiles
  - AI status card
  - Defaults card (Tasks list, event duration, timezone)
  - Privacy card
  - Diagnostics card
  - LLM provider card (for future BYO API key support)

## Chrome APIs Used

### Extension APIs

- `chrome.storage.local` - State persistence (profile, defaults, completed tiles, AI status)
- `chrome.identity.getAuthToken` - OAuth token retrieval
- `chrome.identity.removeCachedAuthToken` - Sign-out
- `chrome.tabs.create` - Open Calendar template URL
- `chrome.scripting` - Dynamic content script injection
- `chrome.runtime.onInstalled` - Installation handling
- `chrome.runtime.sendMessage` - Inter-component messaging

### Chrome AI API

- `LanguageModel.create()` - Create Gemini Nano session
- `LanguageModel.availability()` - Check hardware support
- `session.prompt()` - Run extraction with JSON schema constraint

## Google APIs

### OAuth 2.0

- **Client Type**: Chrome Extension
- **Scopes**:
  - `openid` - OpenID Connect
  - `https://www.googleapis.com/auth/userinfo.profile` - User profile
  - `https://www.googleapis.com/auth/userinfo.email` - User email
  - `https://www.googleapis.com/auth/tasks` - Tasks API

### OAuth Setup for Publication

To publish this extension with Google OAuth, you'll need to complete the following in the Google Cloud Console:

#### 1. Google Cloud Console Project

- Create a new project in [Google Cloud Console](https://console.cloud.google.com)
- Enable the following APIs:
  - **Tasks API** (`tasks.googleapis.com`)
  - **Google Identity Platform** (for OAuth)

#### 2. OAuth Consent Screen

- Navigate to: APIs & Services → OAuth consent screen
- **User Type**: External (for public Chrome Web Store distribution)
- **Required Fields**:
  - **App name**: "Email 2 Event" (or your chosen name)
  - **User support email**: Your support email address
  - **Developer contact email**: Your email address
  - **Application logo**: 128x128px logo (required for verification)
  - **Application home page**: Your extension's landing page or GitHub repo
  - **Authorized domains**: `chrome-extension://` (or leave blank if not required)
  - **Application privacy policy link**: URL to your privacy policy (required)
  - **Application terms of service link**: Optional but recommended

#### 3. OAuth Client ID Creation

- Navigate to: APIs & Services → Credentials
- Click "Create Credentials" → "OAuth client ID"
- **Application type**: Chrome Extension
- **Name**: "Email 2 Event Extension"
- **Extension ID**: Your published Chrome Web Store extension ID (you'll get this after publishing)
  - During development, you can use your unpacked extension ID from `chrome://extensions`
- **Scopes**: Add the following scopes:
  - `openid`
  - `https://www.googleapis.com/auth/userinfo.profile`
  - `https://www.googleapis.com/auth/userinfo.email`
  - `https://www.googleapis.com/auth/tasks`

#### 4. Scope Verification

- The `tasks` scope is **non-sensitive**, so verification is lightweight
- The `openid`, `profile`, and `email` scopes are **basic** and typically auto-approved
- You may need to submit for verification if Google flags your app
- Verification requirements:
  - Demonstrate that each requested scope is used for a specific feature
  - Provide screenshots or videos showing the scope in use
  - Explain how the scope benefits the user
- For this extension:
  - `tasks`: Used to create Google Tasks from emails (shown in review modal)
  - `openid/profile/email`: Used to display user avatar/name and for authentication
  - No Gmail API scope is requested (email is read via DOM only)
  - No Calendar API scope is requested (uses public template URL)

#### 5. Update Manifest

- Copy the OAuth client ID from the Credentials page
- Update `manifest.json`:
  ```json
  "oauth2": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "openid",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/tasks"
    ]
  }
  ```

#### 6. Chrome Web Store Publication

- Before publishing, ensure you have:
  - **Privacy Policy**: Hosted publicly (e.g., GitHub Pages, your website)
    - Must explicitly state: "Email content is processed on-device by Chrome's built-in AI"
    - Must explain: "Tasks scope is only used to create tasks you explicitly save"
  - **Screenshots**: At least one screenshot (1280x800 or 640x400)
  - **Promotional images**: Optional but recommended
  - **Extension ID**: From Chrome Web Store Developer Dashboard
- After getting your extension ID from the Chrome Web Store:
  - Update the OAuth client ID in Google Cloud Console with the correct extension ID
  - Rebuild and republish the extension

#### 7. Testing Before Publication

- Test the OAuth flow with the production client ID
- Verify all scopes work correctly:
  - Sign-in flow retrieves user profile
  - Task creation successfully uses the Tasks API
  - Calendar flow works without OAuth (template URL)
- Test on a clean Chrome profile (no cached tokens)

#### Important Notes

- **Do not use a web application client ID** for Chrome extensions - must be "Chrome Extension" type
- **The extension ID in the OAuth client must match the published extension ID** for production
- **OAuth verification can take 3-7 business days** for sensitive scopes (not needed for this extension)
- **Keep the OAuth consent screen updated** if you change the app name, logo, or privacy policy URL
- **Monitor the OAuth consent screen** for any warnings or required updates from Google

### Tasks API v1

- Endpoint: `https://www.googleapis.com/tasks/v1/`
- Operations:
  - `GET /tasks/v1/users/@me/lists` - List task lists
  - `POST /tasks/v1/lists/{listId}/tasks` - Create task

### Calendar

- **Method**: Public template URL (no API scope required)
- URL: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=...&details=...&location=...`

## Dependencies

### Runtime

- **zod** 3.23.0 - Schema validation for LLM outputs

### Development

- **@types/chrome** 0.0.260 - TypeScript type definitions for Chrome APIs
- **typescript** 5.4.0 - TypeScript compiler
- **vite** 5.2.0 - Build tool
- **@crxjs/vite-plugin** 2.0.0-beta.23 - Chrome extension build plugin

## Design System

### Typography

- **Font Family**: Inter (self-hosted woff2), falling back to system stack
- **Weights**: 400 (body), 500 (labels/buttons), 600 (headlines)
- **Line Heights**: 1.55 (body), 1.4 (compact)
- **Letter Spacing**: -0.01em to -0.02em (headlines)
- **Monospace**: SF Mono, Menlo, Consolas

### Color Palette (Stripe-inspired)

- **Background**: `#ffffff` (page), `#f6f9fc` (muted)
- **Text**: `#0a2540` (primary), `#425466` (secondary), `#697386` (tertiary)
- **Accent**: `#635bff` (Stripe indigo)
- **Borders**: `#e3e8ee`
- **Semantic**: `#0e9f6e` (success), `#d97706` (warning), `#df1b41` (error)

### Spacing

- **Base Grid**: 8pt
- **Card Padding**: 24-32px
- **Section Spacing**: 48-64px

### Components

- **Buttons**: Primary (filled accent), Secondary (white with border), Ghost (transparent)
- **Cards**: 12px radius, soft shadows
- **Form Controls**: 6px radius, 12px vertical padding, 2px focus outline
- **Status Pills**: 999px radius, 4px 10px padding

### Implementation

- **CSS**: Plain CSS with custom properties (CSS variables)
- **Tokens**: Defined in `src/shared/tokens.css`
- **No Frameworks**: No Tailwind, no component library (v1)

## State Management

- **Storage**: `chrome.storage.local`
- **Shape**:
  ```typescript
  {
    profile?: { name, email, picture },
    completedTiles: string[],
    defaults: { taskListId, taskListName, eventDurationMins, timezone },
    aiStatus: "available" | "downloadable" | "downloading" | "unavailable"
  }
  ```
- **Reactivity**: Dashboard subscribes to `chrome.storage.onChanged` and `LanguageModel` availability changes

## File Structure

```
/manifest.json
/src
  /background
    service-worker.ts
    install.ts
    llm.ts
    /google
      auth.ts
      userinfo.ts
      tasks.ts
      calendar-url.ts
  /content
    gmail.ts
    selectors.ts
    extract.ts
    llm.ts
    review-modal.ts
    modal.css
  /landing
    dashboard.html
    dashboard.ts
    dashboard.css
    /components
      top-bar.ts
      onboarding-tiles.ts
      ai-status-card.ts
      defaults-card.ts
      privacy-card.ts
      diagnostics-card.ts
      llm-provider-card.ts
  /shared
    types.ts
    schema.ts
    prompt.ts
    date-utils.ts
    tokens.css
/icons
```

## Security & Privacy

- **Email Processing**: On-device via Chrome's Gemini Nano (no network transmission)
- **OAuth**: Only requests scopes for features actually used (Tasks API, profile)
- **Storage**: Secrets stored in `chrome.storage.local` (not synced)
- **Gmail Access**: DOM-only (no Gmail API scope requested)
- **Calendar Access**: Public template URL (no Calendar API scope)

## Future v1.1 Additions (Planned)

- **Ollama Integration**: Local LLM on `localhost:11434`
- **BYO API Keys**: Anthropic, OpenAI, Gemini with per-provider settings
- **Multi-tier Logic**: Automatic LLM selection with user override
