import * as fs from 'fs';
import * as path from 'path';
import { OpenApiDocument, OpenApiParser } from './parsers/openapi.parser';
import { BodyGenerator } from './generators/body.generator';
import { EnvironmentGenerator } from './generators/environment.generator';
import { FolderBuilder } from './builders/folder.builder';
import { RequestBuilder } from './builders/request.builder';
import { CollectionValidator } from './validators/collection.validator';

// openapi-to-postmanv2 is a CommonJS module with no official types
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Converter = require('openapi-to-postmanv2');

export interface PostmanGeneratorOptions {
  swaggerDoc: OpenApiDocument;
  baseUrl: string;
  outputDir: string;
}

export class PostmanGeneratorEngine {
  private parser: OpenApiParser;
  private bodyGenerator: BodyGenerator;
  private envGenerator: EnvironmentGenerator;
  private folderBuilder: FolderBuilder;
  private requestBuilder: RequestBuilder;
  private validator: CollectionValidator;

  constructor(private options: PostmanGeneratorOptions) {
    this.parser = new OpenApiParser(options.swaggerDoc);
    this.bodyGenerator = new BodyGenerator(this.parser);
    this.envGenerator = new EnvironmentGenerator();
    this.folderBuilder = new FolderBuilder();
    this.requestBuilder = new RequestBuilder();
    this.validator = new CollectionValidator();
  }

  async generate(): Promise<{ collectionPath: string; environmentPath: string }> {
    const { swaggerDoc, baseUrl, outputDir } = this.options;

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const collectionPath = path.join(outputDir, 'erp.postman_collection.json');
    const environmentPath = path.join(outputDir, 'erp.environment.json');

    const conversionOptions = {
      folderStrategy: 'Tags',
      requestParametersResolution: 'Example',
      exampleParametersResolution: 'Example',
      schemaFakerOptions: {
        alwaysFakeOptionals: true,
      },
    };

    return new Promise((resolve, reject) => {
      Converter.convert(
        { type: 'json', data: swaggerDoc },
        conversionOptions,
        (err: any, conversionResult: any) => {
          if (err || !conversionResult.result) {
            return reject(err || new Error(conversionResult.reason));
          }

          const rawCollection = conversionResult.output[0].data;

          // 1. Root Collection Metadata
          rawCollection.info.name = 'School ERP Monolith';
          rawCollection.info.description =
            'Enterprise Postman Collection v2 automatically generated from OpenAPI spec. ZERO manual edits required.';

          // 2. Global Bearer Auth
          rawCollection.auth = {
            type: 'bearer',
            bearer: [
              {
                key: 'token',
                value: '{{accessToken}}',
                type: 'string',
              },
            ],
          };

          // 3. Pre-request & Test Scripts
          this.injectScripts(rawCollection);

          // 4. Process Requests, Enhance DTO Bodies, and Build Domain/Controller Folder Tree
          this.folderBuilder.reset();

          this.processItemsRecursively(rawCollection.item, (requestItem, currentTags) => {
            const method = (requestItem.request?.method || 'GET').toUpperCase();
            const urlRaw = requestItem.request?.url?.raw || (typeof requestItem.request?.url === 'string' ? requestItem.request?.url : '');
            const cleanUrl = urlRaw.split('?')[0];

            // Match operation in OpenAPI document
            const pathKey = this.findMatchingOpenApiPath(cleanUrl, swaggerDoc);
            const operation = pathKey && swaggerDoc.paths?.[pathKey] ? swaggerDoc.paths[pathKey][method.toLowerCase()] : null;

            // Combine tags from operation and folder tags
            const tags = operation?.tags || currentTags;

            // Format request naming, variables, parameters, and headers
            const formattedItem = this.requestBuilder.formatRequestItem(requestItem, operation);

            // Enhance DTO Request Body for POST/PATCH/PUT
            this.enhanceRequestBody(formattedItem, swaggerDoc, pathKey, operation);

            // Add into hierarchical folder builder
            this.folderBuilder.addRequest(formattedItem, tags);
          });

          // 5. Construct Hierarchical Domain -> Controller Folder Structure
          rawCollection.item = this.folderBuilder.buildCollectionItems();

          // 6. Validate Collection Integrity
          const validation = this.validator.validateCollection(rawCollection);
          if (validation.warnings.length > 0) {
            console.log('\n⚠️ Generator Validation Warnings:');
            validation.warnings.forEach((w) => console.log(`   - ${w}`));
          }

          // 7. Write Collection JSON File
          fs.writeFileSync(
            collectionPath,
            JSON.stringify(rawCollection, null, 2),
            'utf8',
          );

          // 8. Generate & Write Environment File
          const envData = this.envGenerator.generateEnvironment(swaggerDoc, baseUrl);
          fs.writeFileSync(
            environmentPath,
            JSON.stringify(envData, null, 2),
            'utf8',
          );

          resolve({ collectionPath, environmentPath });
        },
      );
    });
  }

  /**
   * Traverse raw OpenAPI converted items and extract request nodes
   */
  private processItemsRecursively(
    items: any[],
    callback: (item: any, tags: string[]) => void,
    currentTags: string[] = [],
  ) {
    if (!items || !Array.isArray(items)) return;

    for (const item of items) {
      if (item.item && Array.isArray(item.item)) {
        const tags = [...currentTags, item.name];
        this.processItemsRecursively(item.item, callback, tags);
      } else if (item.request) {
        callback(item, currentTags);
      }
    }
  }

  /**
   * Enhance request body for POST/PATCH/PUT using Swagger component schemas
   */
  private enhanceRequestBody(item: any, doc: OpenApiDocument, pathKey?: string | null, operation?: any) {
    const method = item.request?.method || 'GET';
    if (!['POST', 'PATCH', 'PUT'].includes(method)) return;

    if (!operation && pathKey && doc.paths?.[pathKey]) {
      operation = doc.paths[pathKey][method.toLowerCase()];
    }

    if (!operation || !operation.requestBody) return;

    const content = operation.requestBody.content || {};
    const jsonContent = content['application/json'];

    if (jsonContent && jsonContent.schema) {
      const formattedJsonBody = this.bodyGenerator.generateJsonBody(jsonContent.schema);

      item.request.body = {
        mode: 'raw',
        raw: formattedJsonBody,
        options: {
          raw: {
            language: 'json',
          },
        },
      };
    }
  }

  /**
   * Match a Postman URL path against OpenAPI path keys
   */
  private findMatchingOpenApiPath(url: string, doc: OpenApiDocument): string | null {
    if (!doc.paths) return null;

    let pathOnly = url;
    if (pathOnly.includes('://')) {
      try {
        const urlObj = new URL(pathOnly);
        pathOnly = urlObj.pathname;
      } catch (e) {}
    }
    if (pathOnly.startsWith('/v1')) {
      pathOnly = pathOnly.replace('/v1', '');
    }

    if (doc.paths[pathOnly]) return pathOnly;

    const normalizedTarget = pathOnly.replace(/:([a-zA-Z0-9_]+)/g, '{}').replace(/\{\w+\}/g, '{}');

    for (const openApiPath of Object.keys(doc.paths)) {
      const normalizedOpenApi = openApiPath.replace(/\{\w+\}/g, '{}');
      if (normalizedTarget === normalizedOpenApi) {
        return openApiPath;
      }
    }

    return null;
  }

  /**
   * Inject collection level scripts for auto-auth and trace headers
   */
  private injectScripts(collection: any) {
    const prerequestScript = [
      '// Pre-request script to automatically add tenant, branch, and academic year headers',
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

    const testScript = [
      '// Global collection-level verification and auto-save test suite',
      'try {',
      '    pm.test("Status code is 2xx", function () {',
      '        pm.response.to.be.success;',
      '    });',
      '    pm.test("Traceability: x-request-id header is present", function () {',
      '        pm.response.to.have.header("x-request-id");',
      '    });',
      '',
      '    const response = pm.response.json();',
      '    const isLogin = pm.request.url.path.some(segment => segment.toLowerCase() === "login");',
      '    if (isLogin && response.data && response.data.accessToken) {',
      '        const token = response.data.accessToken;',
      '        pm.environment.set("accessToken", token);',
      '        try {',
      '            const parts = token.split(".");',
      '            if (parts.length === 3) {',
      '                const payload = JSON.parse(atob(parts[1]));',
      '                if (payload.organizationId) pm.environment.set("organizationId", payload.organizationId);',
      '                if (payload.branchId) pm.environment.set("branchId", payload.branchId);',
      '            }',
      '        } catch (e) {}',
      '    }',
      '',
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
      '        if (lastSegment) {',
      '            let singular = lastSegment;',
      '            if (singular.endsWith("ies")) singular = singular.slice(0, -3) + "y";',
      '            else if (singular.endsWith("s") && !singular.endsWith("ss")) singular = singular.slice(0, -1);',
      '            const camelCase = singular.replace(/-([a-z])/g, (g) => g[1].toUpperCase());',
      '            const varName = camelCase + "Id";',
      '            pm.environment.set(varName, response.data.id);',
      '        }',
      '    }',
      '} catch (e) {}',
    ];

    collection.event = [
      {
        listen: 'prerequest',
        script: { type: 'text/javascript', exec: prerequestScript },
      },
      {
        listen: 'test',
        script: { type: 'text/javascript', exec: testScript },
      },
    ];
  }
}
