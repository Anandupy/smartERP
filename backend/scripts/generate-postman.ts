/* eslint-disable no-console, @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises */
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
// openapi-to-postmanv2 is a CommonJS module with no official types, import via require
const Converter = require('openapi-to-postmanv2');

/**
 * Enterprise School ERP Postman Automation Generator
 *
 * DESIGN PRINCIPLES & SCALABILITY:
 * 1. Single Source of Truth: Swagger/OpenAPI spec acts as the sole source of truth. All API changes,
 *    new controllers, and modules automatically propagate here.
 * 2. Zero Manual Maintenance: No need for manual add-xxx-postman scripts. New endpoints are
 *    automatically auto-detected, parsed, and updated.
 * 3. Dynamic Variable Extraction: Pre-request/test scripts handle tenant headers and dynamic variable
 *    capture (e.g. login tokens, created resource IDs) automatically on the collection level.
 */

const BACKEND_URL = 'http://localhost:3000';
const SWAGGER_JSON_URL = `${BACKEND_URL}/api-json`;
const OUTPUT_DIR = path.join(__dirname, '../postman');
const COLLECTION_PATH = path.join(OUTPUT_DIR, 'erp.postman_collection.json');
const ENVIRONMENT_PATH = path.join(OUTPUT_DIR, 'erp.environment.json');

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

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Conversion options for openapi-to-postmanv2
  const options = {
    folderStrategy: 'Tags', // Groups endpoints by Swagger tags/modules automatically
    requestParametersResolution: 'Example',
    exampleParametersResolution: 'Example',
    schemaFakerOptions: {
      alwaysFakeOptionals: true,
    },
  };

  console.log('⚙️  Converting Swagger OpenAPI spec to Postman collection...');

  Converter.convert(
    { type: 'json', data: swaggerData },
    options,
    (err: any, conversionResult: any) => {
      if (err) {
        console.error('❌ Conversion error: ', err);
        return;
      }
      if (!conversionResult.result) {
        console.error(
          '❌ Failed to convert Swagger to Postman: ',
          conversionResult.reason,
        );
        return;
      }

      const collection = conversionResult.output[0].data;

      // Rename the collection to something premium
      collection.info.name = 'School ERP Monolith';
      collection.info.description =
        'Automatically generated Postman collection from Swagger/OpenAPI. ZERO manual edits required.';

      // 1. Inject Global Bearer Authentication at the collection root
      collection.auth = {
        type: 'bearer',
        bearer: [
          {
            key: 'token',
            value: '{{accessToken}}',
            type: 'string',
          },
        ],
      };

      // 2. Inject Collection-Level Pre-Request Script (for Tenant/Branch/AcademicYear Headers)
      const prerequestScript = [
        '// Pre-request script to automatically add tenant, organization, and branch headers if they are set in the environment',
        'const tenantId = pm.environment.get("tenantId");',
        'const organizationId = pm.environment.get("organizationId");',
        'const branchId = pm.environment.get("branchId");',
        'const academicYearId = pm.environment.get("academicYearId");',
        '',
        'if (tenantId && !pm.request.headers.has("x-tenant-id")) {',
        '    pm.request.headers.add({ key: "x-tenant-id", value: "{{tenantId}}" });',
        '}',
        'if (organizationId && !pm.request.headers.has("x-organization-id")) {',
        '    pm.request.headers.add({ key: "x-organization-id", value: "{{organizationId}}" });',
        '}',
        'if (branchId && !pm.request.headers.has("x-branch-id")) {',
        '    pm.request.headers.add({ key: "x-branch-id", value: "{{branchId}}" });',
        '}',
        'if (academicYearId && !pm.request.headers.has("x-academic-year-id")) {',
        '    pm.request.headers.add({ key: "x-academic-year-id", value: "{{academicYearId}}" });',
        '}',
      ];

      // 3. Inject Collection-Level Test Script (for Traceability, Login Token Auto-Capture, and created resource ID extraction)
      const testScript = [
        '// Global collection-level verification and auto-save test suite',
        'try {',
        '    // Verify response status is 2xx',
        '    pm.test("Status code is 2xx", function () {',
        '        pm.response.to.be.success;',
        '    });',
        '',
        '    // Verify x-request-id is present for traceability',
        '    pm.test("Traceability: x-request-id header is present", function () {',
        '        pm.response.to.have.header("x-request-id");',
        '    });',
        '',
        '    const response = pm.response.json();',
        '',
        '    // Capture JWT access token from login endpoint and decode organizationId & branchId',
        '    const isLogin = pm.request.url.path.some(segment => segment.toLowerCase() === "login");',
        '    if (isLogin && response.data && response.data.accessToken) {',
        '        const token = response.data.accessToken;',
        '        pm.environment.set("accessToken", token);',
        '        console.log("[Auto-Auth] Access Token saved successfully.");',
        '        ',
        '        try {',
        '            const parts = token.split(".");',
        '            if (parts.length === 3) {',
        '                const payload = JSON.parse(atob(parts[1]));',
        '                if (payload.organizationId) {',
        '                    pm.environment.set("organizationId", payload.organizationId);',
        '                    console.log("[Auto-Auth] Extracted organizationId: " + payload.organizationId);',
        '                }',
        '                if (payload.branchId) {',
        '                    pm.environment.set("branchId", payload.branchId);',
        '                    console.log("[Auto-Auth] Extracted branchId: " + payload.branchId);',
        '                }',
        '            }',
        '        } catch (e) {',
        '            console.error("JWT Decode error:", e);',
        '        }',
        '    }',
        '',
        '    // Dynamic resource ID capture for POST requests',
        '    // E.g., POST /programs returning { success: true, data: { id: "123" } } maps to programId',
        '    if (pm.request.method === "POST" && response.success && response.data && response.data.id) {',
        '        const pathSegments = pm.request.url.path;',
        '        let lastSegment = "";',
        '        for (let i = pathSegments.length - 1; i >= 0; i--) {',
        '            const segment = pathSegments[i];',
        '            if (segment && !segment.startsWith("{{") && !segment.startsWith(":")) {',
        '                lastSegment = segment;',
        '                break;',
        '            }',
        '        }',
        '        ',
        '        if (lastSegment) {',
        '            let singular = lastSegment;',
        '            if (singular.endsWith("ies")) {',
        '                singular = singular.slice(0, -3) + "y";',
        '            } else if (singular.endsWith("es")) {',
        '                if (singular.endsWith("ches") || singular.endsWith("shes") || singular.endsWith("xes") || singular.endsWith("zes")) {',
        '                    singular = singular.slice(0, -2);',
        '                } else {',
        '                    singular = singular.slice(0, -1);',
        '                }',
        '            } else if (singular.endsWith("s") && !singular.endsWith("is") && !singular.endsWith("us") && !singular.endsWith("as")) {',
        '                singular = singular.slice(0, -1);',
        '            }',
        '            ',
        '            // Convert kebab-case to camelCase (e.g. blood-groups -> bloodGroup)',
        '            const camelCase = singular.replace(/-([a-z])/g, (g) => g[1].toUpperCase());',
        '            const varName = camelCase + "Id";',
        '            pm.environment.set(varName, response.data.id);',
        '            console.log(`[Auto-Save] Extracted generated resource ID into variable: ${varName} = ${response.data.id}`);',
        '        }',
        '    }',
        '} catch (e) {',
        '    // Quietly fail for non-JSON responses',
        '}',
      ];

      collection.event = [
        {
          listen: 'prerequest',
          script: {
            type: 'text/javascript',
            exec: prerequestScript,
          },
        },
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: testScript,
          },
        },
      ];

      // Write collection JSON to file
      try {
        fs.writeFileSync(
          COLLECTION_PATH,
          JSON.stringify(collection, null, 2),
          'utf8',
        );
        console.log(`🚀 Collection generated successfully: ${COLLECTION_PATH}`);
      } catch (writeErr) {
        console.error('❌ Error writing collection file: ', writeErr);
      }
    },
  );
}

run();
