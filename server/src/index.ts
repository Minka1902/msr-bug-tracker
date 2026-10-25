import { createApp } from './app';
import { config } from './config';
import { migrate } from './db/migrate';
import { logger } from './lib/logger';

await migrate();
createApp().listen(config.PORT, () => logger.info(`API listening on :${config.PORT}`));
