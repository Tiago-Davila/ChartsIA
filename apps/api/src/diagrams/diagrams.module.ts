import { Module } from '@nestjs/common';
import { newDiagramId } from '@chartsia/core/model';
import { DiagramCommandService } from './diagram-command.service.js';
import { DiagramEvents } from './diagram-events.js';
import { DiagramQueryService } from './diagram-query.service.js';
import { ExportService } from './export.service.js';
import { PersistenceModule } from './persistence/persistence.module.js';
import { CLOCK, DIAGRAM_ID_GENERATOR } from './tokens.js';

@Module({
  imports: [PersistenceModule],
  providers: [
    DiagramEvents,
    DiagramQueryService,
    DiagramCommandService,
    ExportService,
    { provide: CLOCK, useValue: () => new Date() },
    { provide: DIAGRAM_ID_GENERATOR, useValue: newDiagramId },
  ],
  exports: [DiagramEvents, DiagramQueryService, DiagramCommandService, ExportService],
})
export class DiagramsModule {}
