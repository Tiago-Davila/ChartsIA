import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type DynamicModule, Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';

/** `apps/web/dist` relativo a `apps/api/dist` (o `src` en tests). */
export function defaultWebDist(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../../web/dist');
}

/**
 * Sirve la app compilada en `/` con fallback a `index.html` para sus rutas (`/d/:id`). Solo
 * se activa si existe `dist`; `/api`, `/mcp` y `/socket.io` quedan fuera.
 */
@Module({})
export class WebStaticModule {
  static forRoot(dir: string = defaultWebDist()): DynamicModule {
    if (!existsSync(join(dir, 'index.html'))) return { module: WebStaticModule };
    return {
      module: WebStaticModule,
      imports: [
        ServeStaticModule.forRoot({
          rootPath: dir,
          exclude: ['/api/{*path}', '/mcp', '/mcp/{*path}', '/socket.io/{*path}'],
          serveStaticOptions: { index: 'index.html', fallthrough: true },
        }),
      ],
    };
  }
}
