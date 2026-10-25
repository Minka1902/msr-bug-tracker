import { createApp } from './app';
import { config } from './config';
import { migrate } from './db/migrate';
import { logger } from './lib/logger';
import { ensureStorage } from './lib/storage';

await migrate();
await ensureStorage();
createApp().listen(config.PORT, () => logger.info(`API listening on :${config.PORT}`));
