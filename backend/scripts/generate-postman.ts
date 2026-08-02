/* eslint-disable */
import * as path from 'path';
import axios from 'axios';
import { PostmanGeneratorEngine } from './postman/index';

/**
 * CampusFlow ERP Enterprise Postman Collection Generator CLI
 *
 * DESIGN PRINCIPLES & SCALABILITY:
 * 1. Single Source of Truth: Swagger/OpenAPI spec acts as the sole source of truth. All API changes,
 *    new controllers, and modules automatically propagate here.
 * 2. Zero Manual Maintenance: No need for manual add-xxx-postman scripts. New endpoints are
 *    automatically auto-detected, parsed, and updated.
 * 3. Dynamic Variable Extraction & Intelligent DTO Faking: Generates complete JSON request bodies with UUID detection
 *    and maps endpoints to an enterprise domain folder structure.
 */

const BACKEND_URL = 'http://localhost:3001';
const SWAGGER_JSON_URL = `${BACKEND_URL}/api-json`;
const OUTPUT_DIR = path.join(__dirname, '../postman');

async function run() {
  console.log('🔄 Fetching Swagger schema from: ' + SWAGGER_JSON_URL);

  let swaggerData: any;
  try {
    const response = await axios.get(SWAGGER_JSON_URL, { timeout: 3000 });
    swaggerData = response.data;
    console.log('✅ Swagger schema fetched successfully from running server.');
  } catch {
    console.log(
      'ℹ️ HTTP endpoint unreachable at ' +
        SWAGGER_JSON_URL +
        '. Generating Swagger schema in-memory from NestJS app source...',
    );
    try {
      const { NestFactory } = await import('@nestjs/core');
      const { AppModule } = await import('../src/app.module');
      const { DocumentBuilder, SwaggerModule } =
        await import('@nestjs/swagger');

      const app = await NestFactory.create(AppModule, { logger: false });
      const swaggerConfig = new DocumentBuilder()
        .setTitle('ERP API')
        .setDescription('The ERP system API description')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
      swaggerData = SwaggerModule.createDocument(app, swaggerConfig);
      await app.close();
      console.log(
        '✅ Swagger schema generated in-memory from NestJS app source.',
      );
    } catch (err: any) {
      console.error('❌ In-memory Swagger generation failed:', err);
      return;
    }
  }

  console.log('⚙️  Running Enterprise Postman Generator Engine v2...');

  try {
    const engine = new PostmanGeneratorEngine({
      swaggerDoc: swaggerData,
      baseUrl: BACKEND_URL,
      outputDir: OUTPUT_DIR,
    });

    const result = await engine.generate();
    console.log(
      `🚀 Collection generated successfully: ${result.collectionPath}`,
    );
    console.log(
      `🌍 Environment generated successfully: ${result.environmentPath}`,
    );
  } catch (err: any) {
    console.error('❌ Postman generation failed: ', err);
  }
}

run();
