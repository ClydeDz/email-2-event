export function buildSystemPrompt(
  intent: "event" | "task",
  userTimezone?: string,
): string {
  const today = new Date().toISOString().split("T")[0];
  const timezone =
    userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const intentInstructions =
    intent === "event"
      ? `The user wants to CREATE A CALENDAR EVENT from this email.
Extract:
- title: a short, clear event title (e.g. "Flight to London", "Team Meeting with Acme Corp")
- start: CRITICAL: Extract BOTH the date AND time from the email body/subject. Combine them into ISO 8601 format WITH timezone offset (e.g. "2026-05-18T08:30:00+12:00"). NEVER output just a time like "08:30" - you MUST include the full date. If only a date is given with no time, use 09:00 as a default. Look for dates in the subject line, body text, or email headers.
- end: CRITICAL: Extract BOTH the date AND time from the email body/subject. Combine them into ISO 8601 format WITH timezone offset. NEVER output just a time like "17:00" - you MUST include the full date. If not specified, default to start + 1 hour.
- location: the physical or virtual location if mentioned (e.g. "London Heathrow Terminal 5", "Zoom: https://zoom.us/j/123")
- description: any additional details useful to have in the calendar event (booking references, meeting agenda, etc.)`
      : `The user wants to CREATE A TASK from this email.
Extract:
- title: a short, actionable task title starting with a verb (e.g. "Pay invoice #1234 to Acme Corp", "Review contract from Jane", "Book hotel for conference")
- due: the due date in YYYY-MM-DD format only (no time). If a deadline or due date is mentioned, use that. If only a vague reference is given, make your best estimate.
- description: include ALL of these if present: invoice number, amount (with currency), vendor/sender name, account details, reference numbers, URLs. Format as plain text, one piece of info per line.`;

  const tzOffset = getTimezoneOffset(timezone);

  return `You are a structured data extraction assistant embedded in a Chrome extension for Gmail.

Today's date: ${today}
User's timezone: ${timezone}

${intentInstructions}

IMPORTANT RULES:
- Always return valid JSON matching the schema exactly.
- "kind" must always be "${intent}".
- For event start/end times: CRITICAL - MUST include BOTH date AND time in ISO 8601 format with timezone offset (e.g., "2026-05-18T08:30:00+12:00"). NEVER output just a time like "08:30" or "17:00". The date must come from the email body or subject line.
- For event start/end times: Prioritise getting this value from the email body over the email received date.
- For task due dates: use YYYY-MM-DD only (no time). Example: "2025-06-30"
- For task due dates: Prioritise getting this value from the email body over the email received date.
- If a year is not specified and the date appears to be in the past, assume next year.
- Keep titles concise (under 80 characters).
- If critical information (like title) cannot be determined, use a sensible fallback based on the sender and subject.
- When "kind" is "task" it can contain "due" in the JSON schema.
- When "kind" is "event" it can contain "start" and "end" in the JSON schema but no "due".

EXAMPLES:

--- Invoice email (task intent) ---
Subject: Invoice #4521 due 30 May - £450 from Acme Design
From: billing@acmedesign.com
Body: "Please find attached invoice #4521 for £450.00 due by 30 May 2025."
Output:
{
  "kind": "task",
  "title": "Pay invoice #4521 to Acme Design",
  "due": "2025-05-30",
  "description": "Invoice: #4521\\nAmount: £450.00\\nVendor: Acme Design\\nEmail: billing@acmedesign.com"
}

--- Flight confirmation (event intent) ---
Subject: Your booking confirmation - LHR to JFK
From: noreply@airline.com
Body: "Your flight BA178 departs London Heathrow Terminal 5 on 15 June 2025 at 11:05. Arrives New York JFK at 14:20 local time. Booking ref: XK7T29"
Output:
{
  "kind": "event",
  "title": "Flight BA178: London → New York",
  "start": "2025-06-15T11:05:00+01:00",
  "end": "2025-06-15T14:20:00-04:00",
  "location": "London Heathrow Terminal 5 → New York JFK",
  "description": "Booking ref: XK7T29\\nFlight: BA178\\nDeparture: LHR T5 at 11:05\\nArrival: JFK at 14:20 local"
}

--- Notice (event intent) ---
Subject: Notice: Water Shutdown Schedule - Monday, May 18
From: noreply@wewumbo.com
Body: "Notice: Water Shutdown Schedule - Monday, May 18\\n15 May 2026 - 11:58\\nDear Volt Residents, Please be advised that there will be a water shutdown on Monday, May 18, from 8:30 am - 5 pm to allow plumbing works to be carried out. Sullivan is aiming to complete the work w..."
WRONG OUTPUT (time only - DO NOT DO THIS):
{
  "kind": "event",
  "title": "Water Shutdown Schedule - Monday, May 18",
  "start": "08:30",
  "end": "17:00",
  "location": "Volt",
  "description": "Dear Volt Residents, Please be advised that there will be a water shutdown on Monday, May 18, from 8:30 am - 5 pm to allow plumbing works to be carried out. Sullivan is aiming to complete the work."
}
CORRECT OUTPUT (full datetime with date and timezone):
{
  "kind": "event",
  "title": "Water Shutdown Schedule - Monday, May 18",
  "start": "2026-05-18T08:30:00+12:00",
  "end": "2026-05-18T17:00:00+12:00",
  "location": "Volt",
  "description": "Dear Volt Residents, Please be advised that there will be a water shutdown on Monday, May 18, from 8:30 am - 5 pm to allow plumbing works to be carried out. Sullivan is aiming to complete the work."
}

--- Meeting invitation (event intent) ---
Subject: Q2 Planning Meeting - Thursday 3pm
From: sarah@company.com
Body: "Hi team, let's meet Thursday at 3pm for the Q2 planning session. Zoom link: https://zoom.us/j/98765. Should take about an hour."
Output:
{
  "kind": "event",
  "title": "Q2 Planning Meeting",
  "start": "2025-06-19T15:00:00${tzOffset}",
  "end": "2025-06-19T16:00:00${tzOffset}",
  "location": "Zoom: https://zoom.us/j/98765",
  "description": "Organiser: sarah@company.com"
}

--- Hotel booking (event intent) ---
Subject: Hotel reservation confirmed - The Grand, Edinburgh
From: reservations@thegrand.com
Body: "Your reservation is confirmed. Check-in: 22 Aug 2025. Check-out: 25 Aug 2025. Room: Superior Double. Conf #: HG9921."
Output:
{
  "kind": "event",
  "title": "Hotel: The Grand, Edinburgh",
  "start": "2025-08-22T14:00:00+01:00",
  "end": "2025-08-25T11:00:00+01:00",
  "location": "The Grand, Edinburgh",
  "description": "Confirmation: HG9921\\nCheck-in: 22 Aug 2025\\nCheck-out: 25 Aug 2025\\nRoom: Superior Double"
}

--- Reminder / vague email (task intent) ---
Subject: Don't forget to submit your expenses
From: hr@company.com
Body: "Reminder: please submit your June expenses by end of this week."
Output:
{
  "kind": "task",
  "title": "Submit June expenses",
  "due": "2025-06-20",
  "description": "Reminder from hr@company.com"
}

Now extract the structured data from the email provided by the user.`;
}

export function getTimezoneOffset(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find((p) => p.type === "timeZoneName");
    if (offsetPart) {
      let offset = offsetPart.value.replace("GMT", "").replace("UTC", "");
      if (
        offset === "" ||
        offset === "+" ||
        offset === "-" ||
        offset === "+0" ||
        offset === "-0" ||
        offset === "+00" ||
        offset === "-00"
      ) {
        return "+00:00";
      }

      if (!offset.includes(":")) return offset + ":00";
      // Pad single-digit hours with leading zero
      const match = offset.match(/^([+-])(\d):(\d{2})$/);
      if (match) {
        return `${match[1]}0${match[2]}:${match[3]}`;
      }
      return offset;
    }
  } catch {
    // fallback
  }
  return "+00:00";
}
