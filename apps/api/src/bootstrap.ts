import 'reflect-metadata';
import { type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { warmUpLayout } from '@chartsia/core/layout';
import { AppModule } from './app.module.js';
import { announceToken, resolveToken } from './auth/token.js';
import { hostCheck } from './common/host-check.js';
import { JsonLogger } from './common/logger.js';
import { type AppConfig } from './config/config.js';

export interface CreateAppOptions {
  logger?: JsonLogger;
  /** Escritor del aviso de arranque con el token (por defecto stderr). */
  announce?: (text: string) => void;
}

export async function createApp(config: AppConfig, options: CreateAppOptions = {}): Promise<INestApplication> {
  const logger = options.logger ?? new JsonLogger();
  const tokenState = await resolveToken(config);
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot({ config, token: tokenState.token }), {
    logger,
    bodyParser: false,
  });
  app.use(hostCheck(config));
  app.useBodyParser('json', { limit: config.maxRequestBytes });
  app.enableCors({ origin: config.webOrigin });
  app.enableShutdownHooks();
  await app.init();
  announceToken(config.publicUrl, tokenState, options.announce);
  void warmUpLayout();
  return app;
}
