import { describe, it, expect } from 'vitest';
import { buildCalendarTemplateUrl } from './calendar-url';

describe('buildCalendarTemplateUrl', () => {
  it('builds URL with title', () => {
    const extraction = {
      kind: 'event' as const,
      title: 'Team Meeting',
    };
    const url = buildCalendarTemplateUrl(extraction);
    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('text=Team+Meeting');
  });

  it('includes location when provided', () => {
    const extraction = {
      kind: 'event' as const,
      title: 'Team Meeting',
      location: 'Conference Room A',
    };
    const url = buildCalendarTemplateUrl(extraction);
    expect(url).toContain('location=Conference+Room+A');
  });

  it('includes description when provided', () => {
    const extraction = {
      kind: 'event' as const,
      title: 'Team Meeting',
      description: 'Weekly sync',
    };
    const url = buildCalendarTemplateUrl(extraction);
    expect(url).toContain('details=Weekly+sync');
  });

  it('includes dates when start is provided', () => {
    const extraction = {
      kind: 'event' as const,
      title: 'Team Meeting',
      start: '2026-05-15T14:00:00Z',
      end: '2026-05-15T15:00:00Z',
    };
    const url = buildCalendarTemplateUrl(extraction);
    expect(url).toContain('dates=');
  });

  it('handles missing end date by adding 1 hour', () => {
    const extraction = {
      kind: 'event' as const,
      title: 'Team Meeting',
      start: '2026-05-15T14:00:00Z',
    };
    const url = buildCalendarTemplateUrl(extraction);
    expect(url).toContain('dates=');
  });

  it('handles unknown end date by adding 1 hour', () => {
    const extraction = {
      kind: 'event' as const,
      title: 'Team Meeting',
      start: '2026-05-15T14:00:00Z',
      end: 'Unknown',
    };
    const url = buildCalendarTemplateUrl(extraction);
    expect(url).toContain('dates=');
  });

  it('includes all fields when provided', () => {
    const extraction = {
      kind: 'event' as const,
      title: 'Team Meeting',
      start: '2026-05-15T14:00:00Z',
      end: '2026-05-15T15:00:00Z',
      location: 'Conference Room A',
      description: 'Weekly sync',
    };
    const url = buildCalendarTemplateUrl(extraction);
    expect(url).toContain('text=Team+Meeting');
    expect(url).toContain('location=Conference+Room+A');
    expect(url).toContain('details=Weekly+sync');
    expect(url).toContain('dates=');
  });
});
