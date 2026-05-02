import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@/infrastructure/logger/logger.service';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalResponseInterceptor } from '@/interceptors/global-response.interceptor';
import { GlobalExceptionFilter } from '@/filters/global-exception.filter';
import { LoggingInterceptor } from '@/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(LoggerService);
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('env.port', 3000);

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
    new LoggingInterceptor(logger),
    new GlobalResponseInterceptor(),
  );
  app.useGlobalFilters(new GlobalExceptionFilter(logger));

  // Swagger setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ERP API')
    .setDescription('The ERP system API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port);
  logger.log(`Application is running on port ${port}`, 'Bootstrap');
}
bootstrap();
