import { createApp } from './app';
import { config } from './config';
import { migrate } from './db/migrate';
import { logger } from './lib/logger';
import { ensureStorage } from './lib/storage';
import { purgePendingAttachments } from './modules/attachments/service';

await migrate();
await ensureStorage();
const HOUR = 3_600_000;
const purge = () =>
  purgePendingAttachments().catch((err) => logger.error({ err }, 'Pending attachment cleanup failed'));
void purge();
setInterval(purge, HOUR).unref();

createApp().listen(config.PORT, () => logger.info(`API listening on :${config.PORT}`));
