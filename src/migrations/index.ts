import * as migration_20261121_152523_initial from './20261121_152523_initial'

export const migrations = [
  {
    up: migration_20261121_152523_initial.up,
    down: migration_20261121_152523_initial.down,
    name: '20261121_152523_initial',
  },
]
