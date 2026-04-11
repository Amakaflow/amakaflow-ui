import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../api/clients/calendar', () => ({
  getEvents: vi.fn().mockResolvedValue([]),
  getEvent: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  getConnectedCalendars: vi.fn().mockResolvedValue([]),
  createConnectedCalendar: vi.fn(),
  deleteConnectedCalendar: vi.fn(),
  syncConnectedCalendar: vi.fn(),
}));

import { calendarApi } from '../calendar-api';
import * as calendarClient from '../../api/clients/calendar';

describe('calendarApi', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getEvents', () => {
    it('accepts valid YYYY-MM-DD dates', async () => {
      await expect(calendarApi.getEvents('2026-04-10', '2026-04-17')).resolves.toBeDefined();
      expect(calendarClient.getEvents).toHaveBeenCalledWith('2026-04-10', '2026-04-17');
    });

    it('rejects invalid start date format', async () => {
      await expect(calendarApi.getEvents('04/10/2026', '2026-04-17')).rejects.toThrow('Invalid date parameters');
    });

    it('rejects invalid end date format', async () => {
      await expect(calendarApi.getEvents('2026-04-10', 'invalid')).rejects.toThrow('Invalid date parameters');
    });

    it('rejects empty date strings', async () => {
      await expect(calendarApi.getEvents('', '')).rejects.toThrow('Invalid date parameters');
    });
  });

  describe('delegation', () => {
    it('getConnectedCalendars delegates to client', async () => {
      await calendarApi.getConnectedCalendars();
      expect(calendarClient.getConnectedCalendars).toHaveBeenCalled();
    });

    it('deleteEvent delegates to client', async () => {
      await calendarApi.deleteEvent('event-1');
      expect(calendarClient.deleteEvent).toHaveBeenCalledWith('event-1');
    });
  });

  describe('setUserId (deprecated)', () => {
    it('is a no-op and does not throw', () => {
      expect(() => calendarApi.setUserId('user-1')).not.toThrow();
    });
  });
});
