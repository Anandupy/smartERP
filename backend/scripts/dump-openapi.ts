/* eslint-disable */
/**
 * Dumps the generated OpenAPI document to a file, mirroring `main.ts`.
 *
 * Used to audit the response contract without standing up the server:
 * `pnpm openapi:dump` then inspect or diff `openapi.json`.
 */
import * as fs from 'fs';
import * as path from 'path';
import { registerPathAliases } from './register-paths';

async function run() {
  registerPathAliases();

  const { NestFactory } = await import('@nestjs/core');
  const { VersioningType } = await import('@nestjs/common');
  const { AppModule } = await import('../src/app.module');
  const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
  const { applyResponseEnvelope } = await import(
    '../src/common/http/swagger-envelope'
  );

  const app = await NestFactory.create(AppModule, { logger: false });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  const config = new DocumentBuilder()
    .setTitle('ERP API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = applyResponseEnvelope(
    SwaggerModule.createDocument(app, config),
  );

  await app.close();

  const output = process.argv[2] ?? path.join(__dirname, '../openapi.json');
  fs.writeFileSync(output, JSON.stringify(document, null, 2));
  console.log(`OpenAPI document written to ${output}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
