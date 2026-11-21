import * as migration_20261121_152523_initial from './20261121_152523_initial';
import * as migration_20261121_154654_add_drop_engine_tasks from './20261121_154654_add_drop_engine_tasks';
import * as migration_20261121_172758_add_telegram_state_and_channel_url from './20261121_172758_add_telegram_state_and_channel_url';
import * as migration_20261121_204543_phase8_blog_and_ai_drafts from './20261121_204543_phase8_blog_and_ai_drafts';

export const migrations = [
  {
    up: migration_20261121_152523_initial.up,
    down: migration_20261121_152523_initial.down,
    name: '20261121_152523_initial',
  },
  {
    up: migration_20261121_154654_add_drop_engine_tasks.up,
    down: migration_20261121_154654_add_drop_engine_tasks.down,
    name: '20261121_154654_add_drop_engine_tasks',
  },
  {
    up: migration_20261121_172758_add_telegram_state_and_channel_url.up,
    down: migration_20261121_172758_add_telegram_state_and_channel_url.down,
    name: '20261121_172758_add_telegram_state_and_channel_url',
  },
  {
    up: migration_20261121_204543_phase8_blog_and_ai_drafts.up,
    down: migration_20261121_204543_phase8_blog_and_ai_drafts.down,
    name: '20261121_204543_phase8_blog_and_ai_drafts'
  },
];
