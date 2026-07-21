/* eslint-disable no-console, @typescript-eslint/no-floating-promises */
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
    const response = await axios.get(SWAGGER_JSON_URL, { timeout: 5000 });
    swaggerData = response.data;
    console.log('✅ Swagger schema fetched successfully.');
  } catch (error: any) {
    console.log(
      '\n================================================================',
    );
    console.log('⚠️  BACKEND OFFLINE OR UNREACHABLE');
    console.log(`Could not connect to the backend at ${SWAGGER_JSON_URL}`);
    console.log(
      '================================================================',
    );
    console.log('👉 Please start the backend server using:');
    console.log('   pnpm run start:dev');
    console.log(
      '\nThe Postman collection generation will run automatically when',
    );
    console.log(
      'the server starts/restarts or when files change in watch mode.',
    );
    console.log(
      '================================================================\n',
    );
    return; // Exit gracefully, don't crash
  }

  console.log('⚙️  Running Enterprise Postman Generator Engine v2...');

  try {
    const engine = new PostmanGeneratorEngine({
      swaggerDoc: swaggerData,
      baseUrl: BACKEND_URL,
      outputDir: OUTPUT_DIR,
    });

    const result = await engine.generate();
    console.log(`🚀 Collection generated successfully: ${result.collectionPath}`);
    console.log(`🌍 Environment generated successfully: ${result.environmentPath}`);
  } catch (err: any) {
    console.error('❌ Postman generation failed: ', err);
  }
}

run();
