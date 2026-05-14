import type { Extraction } from '../../shared/schema';

export function buildCalendarTemplateUrl(extraction: Extraction): string {
  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', extraction.title);

  if (extraction.start && extraction.end) {
    const fmt = (iso: string) =>
      iso.replace(/[-:]/g, '').replace('.000', '').replace(/\.\d{3}/, '');
    params.set('dates', `${fmt(extraction.start)}/${fmt(extraction.end)}`);
  }

  if (extraction.location) {
    params.set('location', extraction.location);
  }

  if (extraction.description) {
    params.set('details', extraction.description);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
