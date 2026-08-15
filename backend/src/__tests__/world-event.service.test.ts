import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getWorldEventWindow,
  getCurrentWorldEvent,
  mapContinentToEventRegion,
  WORLD_EVENT_VERSION,
  WORLD_EVENT_BOSS_VERSION,
  BOSS_TOTAL_QUESTIONS,
  BOSS_HP_REQUIRED,
} from '../services/worldEvent.service.js';

describe('World Event Service', () => {
  describe('getWorldEventWindow', () => {
    it('returns correct event window for a Monday', () => {
      // 2026-08-10 is the epoch (AFRICA)
      const monday = new Date('2026-08-10T12:00:00.000Z');
      const window = getWorldEventWindow(monday);

      expect(window.eventId).toBe('2026-08-10');
      expect(window.region).toBe('AFRICA');
      expect(window.startsAt.toISOString()).toBe('2026-08-10T00:00:00.000Z');
      expect(window.endsAt.toISOString()).toBe('2026-08-17T00:00:00.000Z');
    });

    it('returns same event for any time within the week', () => {
      const tuesday = new Date('2026-08-11T15:30:00.000Z');
      const sunday = new Date('2026-08-16T23:59:59.000Z');

      const window1 = getWorldEventWindow(tuesday);
      const window2 = getWorldEventWindow(sunday);

      expect(window1.eventId).toBe(window2.eventId);
      expect(window1.region).toBe(window2.region);
    });

    it('returns correct region rotation across 5 weeks', () => {
      const week1 = getWorldEventWindow(new Date('2026-08-10T12:00:00.000Z'));
      const week2 = getWorldEventWindow(new Date('2026-08-17T12:00:00.000Z'));
      const week3 = getWorldEventWindow(new Date('2026-08-24T12:00:00.000Z'));
      const week4 = getWorldEventWindow(new Date('2026-08-31T12:00:00.000Z'));
      const week5 = getWorldEventWindow(new Date('2026-09-07T12:00:00.000Z'));
      const week6 = getWorldEventWindow(new Date('2026-09-14T12:00:00.000Z'));

      expect(week1.region).toBe('AFRICA');
      expect(week2.region).toBe('AMERICAS');
      expect(week3.region).toBe('ASIA');
      expect(week4.region).toBe('EUROPE');
      expect(week5.region).toBe('OCEANIA');
      expect(week6.region).toBe('AFRICA'); // Cycles back
    });

    it('handles year boundary correctly', () => {
      // Test around year boundary
      const dec31 = new Date('2026-12-31T12:00:00.000Z');
      const jan1 = new Date('2027-01-01T12:00:00.000Z');

      const window1 = getWorldEventWindow(dec31);
      const window2 = getWorldEventWindow(jan1);

      // Both should be in the same week (Mon-Sun)
      expect(window1.eventId).toBe(window2.eventId);
    });

    it('same now => same eventId', () => {
      const now = new Date('2026-08-15T10:00:00.000Z');
      const window1 = getWorldEventWindow(now);
      const window2 = getWorldEventWindow(now);

      expect(window1.eventId).toBe(window2.eventId);
      expect(window1.region).toBe(window2.region);
    });

    it('event duration is exactly 7 days', () => {
      const now = new Date('2026-08-12T12:00:00.000Z');
      const window = getWorldEventWindow(now);

      const durationMs = window.endsAt.getTime() - window.startsAt.getTime();
      const expectedMs = 7 * 24 * 60 * 60 * 1000;

      expect(durationMs).toBe(expectedMs);
    });
  });

  describe('mapContinentToEventRegion', () => {
    it('maps Africa correctly', () => {
      expect(mapContinentToEventRegion('Africa')).toBe('AFRICA');
    });

    it('maps Asia correctly', () => {
      expect(mapContinentToEventRegion('Asia')).toBe('ASIA');
    });

    it('maps Europe correctly', () => {
      expect(mapContinentToEventRegion('Europe')).toBe('EUROPE');
    });

    it('maps Oceania correctly', () => {
      expect(mapContinentToEventRegion('Oceania')).toBe('OCEANIA');
    });

    it('maps North America to AMERICAS', () => {
      expect(mapContinentToEventRegion('North America')).toBe('AMERICAS');
    });

    it('maps South America to AMERICAS', () => {
      expect(mapContinentToEventRegion('South America')).toBe('AMERICAS');
    });

    it('returns null for unknown continent', () => {
      expect(mapContinentToEventRegion('Antarctica')).toBeNull();
    });
  });

  describe('constants', () => {
    it('has correct version strings', () => {
      expect(WORLD_EVENT_VERSION).toBe('weekly-world-event-v1');
      expect(WORLD_EVENT_BOSS_VERSION).toBe('regional-boss-v1');
    });

    it('has correct boss constants', () => {
      expect(BOSS_TOTAL_QUESTIONS).toBe(10);
      expect(BOSS_HP_REQUIRED).toBe(7);
    });
  });
});
