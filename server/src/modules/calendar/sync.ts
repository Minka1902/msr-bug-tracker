import { HttpError } from '../../lib/httpError';
import { logger } from '../../lib/logger';
import { openSecret } from '../../lib/secretBox';
import { google } from './google';
import { icloud } from './icloud';
import { markSyncError, staleConnections, storeSyncedEvents, type ConnectionRow } from './service';
import type { CalendarProvider } from './types';

const DAY_MS = 86_400_000;
const WINDOW_BACK_DAYS = 30;
const WINDOW_AHEAD_DAYS = 365;
const SYNC_FAILED = "We couldn't sync this calendar. We'll try again soon.";

const syncing = new Set<string>();

export const connectionClient = (row: ConnectionRow) => ({
  provider: (row.provider === 'google' ? google : icloud) as CalendarProvider<unknown>,
  credentials: JSON.parse(openSecret(row.credentials_sealed)) as unknown,
});

export const syncWindow = () => ({
  from: new Date(Date.now() - WINDOW_BACK_DAYS * DAY_MS),
  to: new Date(Date.now() + WINDOW_AHEAD_DAYS * DAY_MS),
});

export const syncConnection = async (row: ConnectionRow) => {
  if (syncing.has(row.id)) return;
  syncing.add(row.id);
  try {
    const { provider, credentials } = connectionClient(row);
    const calendars = (await provider.listCalendars(credentials)).map((calendar) => {
      const saved = row.calendars.find((item) => item.id === calendar.id);
      return {
        id: calendar.id,
        name: calendar.name,
        color: calendar.color,
        writable: calendar.writable,
        show: saved?.show ?? calendar.selected,
        important: saved?.important ?? false,
      };
    });
    const { from, to } = syncWindow();
    const events = (
      await Promise.all(
        calendars
          .filter((calendar) => calendar.show)
          .map((calendar) => provider.listEvents(credentials, { ...calendar, selected: true }, from, to)),
      )
    ).flat();
    await storeSyncedEvents(row, calendars, events, from, to);
  } catch (error) {
    await markSyncError(row.id, error instanceof HttpError ? error.message : SYNC_FAILED);
    if (!(error instanceof HttpError))
      logger.warn({ err: error, connectionId: row.id }, 'Calendar sync failed');
  } finally {
    syncing.delete(row.id);
  }
};

export const syncStaleConnections = async (userId: string | null = null, staleMinutes = 15, limit = 20) => {
  for (const row of await staleConnections(userId, staleMinutes, limit)) await syncConnection(row);
};
