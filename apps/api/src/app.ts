import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Module,
  ValidationPipe,
  type INestApplication,
  type LoggerService,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';
import helmet from 'helmet';
import { searchModule } from './search';
import { discoveryModule } from './discovery';
import { cmsModule, CmsErrorFilter } from './cms';
import { destinationsModule } from './destinations';
import type { DependencyProbe } from '@visitspakistan/domain';
import type { ServerConfig } from '@visitspakistan/config';

const PROBES = Symbol('DEPENDENCY_PROBES');
const TIMEOUT = Symbol('PROBE_TIMEOUT');
export class JsonLogger implements LoggerService {
  log(message: unknown) {
    console.log(
      JSON.stringify({
        level: 'info',
        ...(typeof message === 'object' && message !== null
          ? message
          : { message: String(message) }),
      }),
    );
  }
  warn(message: unknown) {
    console.warn(JSON.stringify({ level: 'warn', message: String(message) }));
  }
  error() {
    console.error(
      JSON.stringify({ level: 'error', message: 'Application error' }),
    );
  }
}

@Injectable()
export class HealthService {
  private pending?: Promise<{ status: string; checks: Record<string, string> }>;
  constructor(
    @Inject(PROBES) private readonly probes: DependencyProbe[],
    @Inject(TIMEOUT) private readonly timeoutMs: number,
  ) {}

  readiness() {
    // Concurrent HTTP probes share a single bounded check per process.
    this.pending ??= this.check().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }
  private async check() {
    const results = await Promise.all(
      this.probes.map(async (probe) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            probe.check(),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => reject(new Error('Probe timed out')),
                this.timeoutMs,
              );
            }),
          ]);
          return { name: probe.name, required: probe.required, up: true };
        } catch {
          return { name: probe.name, required: probe.required, up: false };
        } finally {
          if (timer) clearTimeout(timer);
        }
      }),
    );
    const checks = Object.fromEntries(
      results.map((result) => [result.name, result.up ? 'up' : 'down']),
    );
    if (results.some((result) => result.required && !result.up))
      throw new HttpException(
        { status: 'unavailable', checks },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    return {
      status: results.every((result) => result.up) ? 'ok' : 'degraded',
      checks,
    };
  }
  async onApplicationShutdown() {
    await Promise.allSettled(this.probes.map((probe) => probe.close()));
  }
}

@ApiTags('platform')
@Controller()
class HealthController {
  constructor(
    @Inject(HealthService) private readonly healthService: HealthService,
  ) {}
  @Get('health')
  @ApiOperation({ summary: 'Process liveness; independent of infrastructure' })
  @ApiResponse({ status: 200, description: 'Process is alive' })
  health() {
    return { status: 'ok', service: 'api' };
  }
  @Get('ready')
  @ApiOperation({
    summary: 'Database/PostGIS readiness and optional capability states',
  })
  @ApiResponse({
    status: 200,
    description: 'Ready; optional services may be degraded',
  })
  @ApiResponse({
    status: 503,
    description: 'Required database/schema/PostGIS unavailable',
  })
  ready() {
    return this.healthService.readiness();
  }
}

export async function createApplication(
  config: ServerConfig,
  probes: DependencyProbe[],
  logger: LoggerService | false = new JsonLogger(),
  shutdownHooks = true,
): Promise<INestApplication> {
  @Module({
    imports: [
      cmsModule(config),
      destinationsModule(config),
      discoveryModule(config),
      searchModule(config),
    ],
    controllers: [HealthController],
    providers: [
      HealthService,
      { provide: PROBES, useValue: probes },
      { provide: TIMEOUT, useValue: config.DEPENDENCY_TIMEOUT_MS },
    ],
  })
  class AppModule {}
  const app = await NestFactory.create(AppModule, { logger });
  app.use(helmet());
  app.useGlobalFilters(new CmsErrorFilter());
  app.enableCors({
    origin: [config.WEB_ORIGIN, config.CMS_ORIGIN],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('Cache-Control', 'no-store');
    const start = performance.now();
    res.on('finish', () => {
      if (logger)
        logger.log({
          event: 'http',
          requestId,
          method: req.method,
          status: res.statusCode,
          durationMs: Math.round(performance.now() - start),
        });
    });
    next();
  });
  if (config.SWAGGER_ENABLED === 'true') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('VisitsPakistan API')
        .setDescription('Platform, published editorial and protected CMS APIs.')
        .setVersion('1.0.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs-json',
    });
  }
  if (shutdownHooks) app.enableShutdownHooks();
  return app;
}
