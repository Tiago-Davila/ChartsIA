import 'reflect-metadata';
import { type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { JsonLogger } from './common/logger.js';
import { type AppConfig } from './config/config.js';

export async function createApp(
  config: AppConfig,
  logger = new JsonLogger(),
): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), {
    logger,
    bodyParser: false,
  });
  app.useBodyParser('json', { limit: config.maxRequestBytes });
  app.enableCors({ origin: config.webOrigin });
  app.enableShutdownHooks();
  return app;
}
