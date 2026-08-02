import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@/common/logger/logger.service';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalResponseInterceptor } from '@/interceptors/global-response.interceptor';
import { GlobalExceptionFilter } from '@/filters/global-exception.filter';
import { RequestLoggingInterceptor } from '@/common/logger/request-logging.interceptor';
import { applyResponseEnvelope } from '@/common/http/swagger-envelope';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'], // Only show critical Nest logs during boot
  });

  const logger = await app.resolve(LoggerService);
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('env.port', 3000) || 3000;
  const env =
    configService.get<string>('env.nodeEnv', 'development') || 'development';

  // Behind a reverse proxy, req.ip is the proxy unless Express is told to trust
  // it — which would make every caller share one rate-limit bucket. Off by
  // default: trusting X-Forwarded-For when nothing strips it lets a client
  // forge its own source address.
  if (configService.get<boolean>('env.trustProxy')) {
    app.getHttpAdapter().getInstance().set('trust proxy', true);
  }

  // Security setup
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  app.enableCors();

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global pipes, interceptors, and filters
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(
    new RequestLoggingInterceptor(logger),
    new GlobalResponseInterceptor(),
  );
  app.useGlobalFilters(new GlobalExceptionFilter(logger));

  // Swagger setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ERP API')
    .setDescription(
      'The ERP system API.\n\n' +
        'Every response uses the shared envelope: `success`, `message`, `data`, ' +
        '`meta`, `error`, `requestId`, `timestamp`. `data` is populated on ' +
        'success and `error` on failure. See docs/core/response-contract.md.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  // Every response passes through GlobalResponseInterceptor or
  // GlobalExceptionFilter, so the generated schemas describe the payload rather
  // than the response. Rewrite them to match what clients actually receive.
  const document = applyResponseEnvelope(
    SwaggerModule.createDocument(app, swaggerConfig),
  );
  SwaggerModule.setup('docs', app, document);

  // Expose /api-json endpoint directly for Postman automation
  app.getHttpAdapter().get('/api-json', (req: any, res: any) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    res.json(document);
  });

  await app.listen(port);

  // Clean Startup Banner using stdout instead of console to avoid ESLint error
  process.stdout.write('\n' + '='.repeat(50) + '\n');
  process.stdout.write(`🚀 ERP Backend Started\n`);
  process.stdout.write(`🌍 Environment: ${env}\n`);
  process.stdout.write(`📦 Version: v1\n`);
  process.stdout.write(`✅ Server running on http://localhost:${port}\n`);
  process.stdout.write('='.repeat(50) + '\n\n');

  logger.log(`Application successfully started on port ${port}`, 'Bootstrap');
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start application:', err);
  process.exit(1);
});
