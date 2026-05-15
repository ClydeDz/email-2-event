# Privacy Policy

**Last updated:** May 2026

## Overview

Email 2 Event is a Chrome extension that helps you create Google Calendar events and Google Tasks from your Gmail emails. We are committed to protecting your privacy and being transparent about how we handle your data.

## Data We Collect

### Email Content

- **What we access:** When you click the extension's buttons in Gmail, we read the content of the currently open email (subject, sender, recipients, date, and body text) from your browser tab.
- **How we access it:** We read this content directly from the Gmail webpage you have open in your browser using standard DOM access. We do not use the Gmail API to access your emails.
- **When we access it:** Only when you explicitly click "Create event" or "Create task" on a specific email. We do not scan, index, or access your emails in the background.

### Google Account Information

- **What we access:** If you choose to sign in with Google, we request access to your basic profile information (name, email address, and profile picture) and permission to create tasks on your behalf.
- **OAuth scopes requested:** `openid`, `https://www.googleapis.com/auth/userinfo.profile`, `https://www.googleapis.com/auth/userinfo.email`, `https://www.googleapis.com/auth/tasks`
- **When we access it:** Only when you explicitly click "Sign in with Google" and authorize the extension.

### Local Storage

- **What we store:** We store your preferences (such as default event duration, timezone, and default Tasks list) and onboarding progress in your browser's local storage (`chrome.storage.local`).
- **Sign-in status:** If you sign in with Google, we cache your profile information locally so we can display your name and avatar in the extension dashboard.

## How We Process Your Data

### On-Device AI Processing

- **Email content processing:** Your email content is processed locally on your device using Chrome's built-in AI (Gemini Nano). This processing happens entirely on your computer—no email content is sent to any server, including our servers or Google's servers.
- **What the AI does:** The AI extracts structured information from your email (such as event dates, times, locations, and descriptions) to pre-populate the Google Calendar or Google Tasks creation forms.
- **Model availability:** Chrome's built-in AI is only available on certain devices with sufficient hardware capabilities. If your device doesn't support on-device AI, the extension will show you a clear message and will not function.

### Google Calendar Events

- **How events are created:** When you click "Create event," we open Google Calendar's native event creation page in a new tab with pre-filled information using a public template URL. You review and click "Save" in Google Calendar's interface.
- **No Calendar API access:** We do not request or use the Google Calendar API scope. Events are created entirely through Google Calendar's public template URL mechanism.

### Google Tasks

- **How tasks are created:** When you click "Create task" and are signed in with Google, we use the Google Tasks API to create a task on your behalf after you review and confirm the extracted information in our modal.
- **API scope:** We only use the `https://www.googleapis.com/auth/tasks` scope, which allows us to create tasks. We do not read, modify, or delete your existing tasks.

## Data Storage and Retention

### Local Storage Only

- All data stored by the extension (preferences, profile cache, onboarding progress) is stored locally in your browser's `chrome.storage.local`.
- This data is not synced to the cloud, shared with any third party, or accessible to us as developers.
- If you uninstall the extension, this local data is deleted from your browser.

### No Server-Side Storage

- We do not have any backend servers, databases, or cloud storage.
- We do not collect, transmit, or store any of your data on our own infrastructure.
- We do not use analytics or tracking services.

## Third-Party Services

### Google

- **Google OAuth:** We use Google's OAuth 2.0 service for sign-in. This is handled through Chrome's built-in `chrome.identity` API.
- **Google Tasks API:** When you create a task, we make an API call to Google's servers to create that task on your behalf.
- **Google Calendar:** We open Google Calendar's website in your browser; all interaction with Google Calendar happens directly between your browser and Google's servers.

### Chrome Built-in AI

- The AI processing is performed by Chrome's built-in Gemini Nano model, which runs entirely on your device. This is a feature of the Chrome browser, not a third-party service we control.

## Your Control Over Your Data

### Revoking Access

- **Uninstall the extension:** At any time, you can uninstall the extension from Chrome, which will remove all locally stored data and revoke our access to your Google account.
- **Revoke Google access:** You can revoke the extension's access to your Google account through your Google Account settings under "Third-party apps & services."
- **Sign out:** You can sign out from within the extension dashboard, which clears your cached profile information from local storage.

### Data Deletion

- Since we don't store your data on our servers, there's nothing for us to delete. All data is stored locally in your browser and is deleted when you uninstall the extension.
- Tasks and events you create through the extension are stored in your Google Account and can be managed through Google Calendar and Google Tasks.

## Security

- **Local processing:** Email content is processed locally on your device, reducing the risk of data interception during transmission.
- **OAuth security:** We use Chrome's secure OAuth implementation for Google sign-in.
- **No data transmission:** Email content is never transmitted to any server.

## Children's Privacy

This extension is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us.

## Changes to This Privacy Policy

We may update this privacy policy from time to time. We will notify users of any material changes by updating the "Last updated" date at the top of this policy. We encourage you to review this privacy policy periodically.

## Contact Us

If you have questions about this privacy policy or our data practices, please contact us through our GitHub repository or via the support email listed in the extension's Chrome Web Store listing.

---

**Note:** This privacy policy applies to the Email 2 Event Chrome extension version 0.1.0 and later. As we add features or make changes to how the extension works, we may update this policy.
