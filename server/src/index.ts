import { createApp } from './app';
import { config } from './config';
import { migrate } from './db/migrate';
import { logger } from './lib/logger';
import { ensureStorage } from './lib/storage';
import { purgePendingAttachments } from './modules/attachments/service';
import { syncStaleConnections } from './modules/calendar/sync';

await migrate();
await ensureStorage();
const HOUR = 3_600_000;
const CALENDAR_SYNC_MS = 5 * 60_000;
const purge = () =>
  purgePendingAttachments().catch((err) => logger.error({ err }, 'Pending attachment cleanup failed'));
void purge();
setInterval(purge, HOUR).unref();
setInterval(
  () => syncStaleConnections().catch((err) => logger.error({ err }, 'Background calendar sync failed')),
  CALENDAR_SYNC_MS,
).unref();

createApp().listen(config.PORT, () => logger.info(`API listening on :${config.PORT}`));
