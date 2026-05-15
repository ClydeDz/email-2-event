# Email 2 Event

A Chrome extension that adds "Create event" and "Create task" buttons to Gmail, using Chrome's built-in on-device AI (Gemini Nano) to extract event details and pre-populate Google Calendar or Tasks.

## On-Device AI (Gemini Nano)

This extension uses Chrome's built-in AI for private, on-device email processing. No email content is sent to any server.

### AI Statuses

- **Available**: Gemini Nano is installed and ready to use.
- **Downloadable**: Your device supports on-device AI but the model needs to be downloaded (~2 GB).
- **Downloading**: The model is currently being downloaded.
- **Unavailable**: Your device doesn't meet the requirements for on-device AI.

### Requirements

To use on-device AI, you need:

- Chrome 138 or later
- Compatible hardware (≥4 GB VRAM or capable integrated GPU)
- All Chrome AI flags enabled:
  1. Visit `chrome://flags`
  2. Enable "Prompt API for Gemini Nano" and "Gemini Nano"
  3. Relaunch Chrome

If your device doesn't support on-device AI, the extension will show an "unavailable" status with instructions to check for Chrome updates or enable the required flags.
TBC
