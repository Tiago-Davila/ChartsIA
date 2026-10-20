import { Logger, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';
import { DiagramLock } from './diagram-lock.js';
import { DIAGRAM_REPOSITORY } from './diagram.repository.js';
import { JsonFileDiagramRepository } from './json-file.repository.js';

@Module({
  providers: [
    {
      provide: DIAGRAM_REPOSITORY,
      inject: [APP_CONFIG],
      useFactory: async (config: AppConfig) => {
        const repo = new JsonFileDiagramRepository(config.dataDir, new Logger('DiagramRepository'));
        await repo.init();
        return repo;
      },
    },
    DiagramLock,
  ],
  exports: [DIAGRAM_REPOSITORY, DiagramLock],
})
export class PersistenceModule {}
