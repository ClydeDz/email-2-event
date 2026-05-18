# Email 2 Event

A Chrome extension that adds a **Create event** button to Gmail to extract event details from your email and pre-populate Google Calendar, all using Chrome's built-in on-device AI (Gemini Nano).

Your email content is processed locally on your device using Chrome's built-in AI (Gemini Nano). This processing happens entirely on your computer. No email content is sent to any server, including our servers or Google's servers.

Chrome's built-in AI is only available on certain devices with sufficient hardware capabilities (Chrome 138 or later with ≥4 GB VRAM or capable integrated GPU), and all "Prompt API for Gemini Nano" and "Gemini Nano" chrome flags are enabled. If your device doesn't support on-device AI, the extension will show you a clear message and will not function.

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

## Credits

Developed by [Clyde D'Souza](https://clydedsouza.net/)
