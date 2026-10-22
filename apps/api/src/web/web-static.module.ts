import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type DynamicModule, Inject, type MiddlewareConsumer, Module, type NestModule, Optional } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const WEB_DIST = Symbol('WEB_DIST');
const RUTAS_DEL_HUB = /^\/(api|mcp|socket\.io)(\/|$)/;

/** `apps/web/dist` relativo a `apps/api/dist` (o `src` en tests). */
export function defaultWebDist(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../../web/dist');
}

/** Crea el middleware que sirve el archivo pedido y, si no existe, `index.html`. */
function servirApp(dir: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const esLectura = req.method === 'GET' || req.method === 'HEAD';
    const ruta = req.originalUrl.split('?')[0] ?? '/';
    if (!esLectura || RUTAS_DEL_HUB.test(ruta)) return next();
    // Con `root`, `send` solo revisa los puntos del pedido y no los de la ruta de `dir`.
    const enviarIndex = () => res.sendFile('index.html', { root: dir }, (err) => err && !res.headersSent && next(err));
    res.sendFile(ruta, { root: dir }, (err) => err && !res.headersSent && enviarIndex());
  };
}

/**
 * Sirve la app compilada en `/` con fallback a `index.html` para sus rutas (`/d/:id`). Solo
 * se activa si existe `dist`; `/api`, `/mcp` y `/socket.io` quedan fuera.
 */
@Module({})
export class WebStaticModule implements NestModule {
  constructor(@Optional() @Inject(WEB_DIST) private readonly dir?: string) {}

  static forRoot(dir: string = defaultWebDist()): DynamicModule {
    if (!existsSync(join(dir, 'index.html'))) return { module: WebStaticModule };
    return { module: WebStaticModule, providers: [{ provide: WEB_DIST, useValue: dir }] };
  }

  configure(consumer: MiddlewareConsumer): void {
    if (this.dir) consumer.apply(servirApp(this.dir)).forRoutes('{*path}');
  }
}
