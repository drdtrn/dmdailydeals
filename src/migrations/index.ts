import * as migration_20261121_152523_initial from './20261121_152523_initial';
import * as migration_20261121_154654_add_drop_engine_tasks from './20261121_154654_add_drop_engine_tasks';

export const migrations = [
  {
    up: migration_20261121_152523_initial.up,
    down: migration_20261121_152523_initial.down,
    name: '20261121_152523_initial',
  },
  {
    up: migration_20261121_154654_add_drop_engine_tasks.up,
    down: migration_20261121_154654_add_drop_engine_tasks.down,
    name: '20261121_154654_add_drop_engine_tasks'
  },
];
