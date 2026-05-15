import type { Extraction } from "../../shared/schema";

/**
 * Parses a date string (ISO 8601 or human-readable) and formats it for Google Calendar URL.
 * Google Calendar expects format: YYYYMMDDTHHMMSSZ
 */
function formatDateForCalendar(dateStr: string): string {
  if (!dateStr || dateStr === "Unknown" || dateStr === "unknown") {
    return "";
  }

  // If already in ISO 8601 format with timezone, just reformat for Google Calendar
  const isoMatch = dateStr.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?([Z+-].*)?$/,
  );
  if (isoMatch) {
    const [, year, month, day, hours, minutes, seconds, tz] = isoMatch;
    // If timezone is Z or has offset, convert to UTC
    if (tz) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        const utcYear = date.getUTCFullYear();
        const utcMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
        const utcDay = String(date.getUTCDate()).padStart(2, "0");
        const utcHours = String(date.getUTCHours()).padStart(2, "0");
        const utcMinutes = String(date.getUTCMinutes()).padStart(2, "0");
        const utcSeconds = String(date.getUTCSeconds()).padStart(2, "0");
        return `${utcYear}${utcMonth}${utcDay}T${utcHours}${utcMinutes}${utcSeconds}Z`;
      }
    }
    // No timezone - treat as local time (use local methods instead of UTC)
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const localYear = date.getFullYear();
      const localMonth = String(date.getMonth() + 1).padStart(2, "0");
      const localDay = String(date.getDate()).padStart(2, "0");
      const localHours = String(date.getHours()).padStart(2, "0");
      const localMinutes = String(date.getMinutes()).padStart(2, "0");
      const localSeconds = String(date.getSeconds()).padStart(2, "0");
      return `${localYear}${localMonth}${localDay}T${localHours}${localMinutes}${localSeconds}`;
    }
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  }

  // Human-readable format - parse and convert to UTC
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      console.warn("[calendar-url] Failed to parse date:", dateStr);
      return "";
    }

    // Use UTC methods to avoid timezone shifts when formatting
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    const seconds = String(date.getUTCSeconds()).padStart(2, "0");

    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  } catch (err) {
    console.warn("[calendar-url] Error formatting date:", dateStr, err);
    return "";
  }
}

export function buildCalendarTemplateUrl(extraction: Extraction): string {
  const params = new URLSearchParams();
  params.set("action", "TEMPLATE");
  params.set("text", extraction.title);

  if (extraction.start) {
    const formattedStart = formatDateForCalendar(extraction.start);
    if (formattedStart) {
      if (
        extraction.end &&
        extraction.end !== "Unknown" &&
        extraction.end !== "unknown"
      ) {
        const formattedEnd = formatDateForCalendar(extraction.end);
        if (formattedEnd) {
          params.set("dates", `${formattedStart}/${formattedEnd}`);
        } else {
          // End date parsing failed, use start + 1 hour as default
          const startDate = new Date(extraction.start);
          const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +1 hour
          const formattedDefaultEnd = formatDateForCalendar(
            endDate.toISOString(),
          );
          params.set("dates", `${formattedStart}/${formattedDefaultEnd}`);
        }
      } else {
        // No end date specified, use start + 1 hour as default
        const startDate = new Date(extraction.start);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +1 hour
        const formattedDefaultEnd = formatDateForCalendar(
          endDate.toISOString(),
        );
        params.set("dates", `${formattedStart}/${formattedDefaultEnd}`);
      }
    }
  }

  if (extraction.location) {
    params.set("location", extraction.location);
  }

  if (extraction.description) {
    params.set("details", extraction.description);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
