import { OpenApiParser, OpenApiDocument } from '@/../scripts/postman/parsers/openapi.parser';
import { BodyGenerator } from '@/../scripts/postman/generators/body.generator';
import { FolderBuilder } from '@/../scripts/postman/builders/folder.builder';
import { RequestBuilder } from '@/../scripts/postman/builders/request.builder';
import { EnvironmentGenerator } from '@/../scripts/postman/generators/environment.generator';

describe('Postman Generator Engine v2', () => {
  const mockSwaggerDoc: OpenApiDocument = {
    openapi: '3.0.0',
    info: { title: 'School ERP Monolith', version: '1.0.0' },
    paths: {
      '/v1/admissions/applicants': {
        post: {
          summary: 'Register applicant',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreateApplicantDto',
                },
              },
            },
          },
        },
        get: {
          summary: 'List applicants',
        },
      },
      '/v1/admissions/applicants/{applicantId}': {
        get: {
          summary: 'Get applicant by ID',
        },
      },
    },
    components: {
      schemas: {
        CreateApplicantDto: {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            primaryEmail: { type: 'string' },
            primaryMobile: { type: 'string' },
            dob: { type: 'string' },
            genderId: { type: 'string' },
            categoryId: { type: 'string' },
            branchId: { type: 'string' },
            disabilityStatus: { type: 'boolean', default: false },
          },
          required: ['firstName', 'lastName', 'primaryMobile', 'genderId'],
        },
      },
    },
  };

  describe('OpenApiParser', () => {
    it('should extract and resolve component schemas and $ref', () => {
      const parser = new OpenApiParser(mockSwaggerDoc);
      const schema = parser.getSchemaByName('CreateApplicantDto');
      expect(schema).toBeDefined();
      expect(schema?.properties?.firstName).toBeDefined();

      const resolved = parser.resolveRef('#/components/schemas/CreateApplicantDto');
      expect(resolved).toEqual(schema);
    });
  });

  describe('BodyGenerator', () => {
    it('should generate complete JSON body with UUID variables and semantic defaults', () => {
      const parser = new OpenApiParser(mockSwaggerDoc);
      const generator = new BodyGenerator(parser);
      const schema = parser.getSchemaByName('CreateApplicantDto')!;

      const jsonStr = generator.generateJsonBody(schema);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.firstName).toBe('John');
      expect(parsed.lastName).toBe('Doe');
      expect(parsed.primaryEmail).toBe('john.doe@example.com');
      expect(parsed.primaryMobile).toBe('9876543210');
      expect(parsed.genderId).toBe('{{genderId}}');
      expect(parsed.categoryId).toBe('{{categoryId}}');
      expect(parsed.branchId).toBe('{{branchId}}');
    });
  });

  describe('FolderBuilder', () => {
    it('should categorize endpoints into domain folders', () => {
      const builder = new FolderBuilder();

      expect(builder.getDomainFolderName('/v1/auth/login', [])).toBe(
        '1. Authentication & Session Management',
      );
      expect(builder.getDomainFolderName('/v1/branches', [])).toBe(
        '2. Organization & Campus Administration',
      );
      expect(builder.getDomainFolderName('/v1/academic-years', [])).toBe(
        '3. Academic Management',
      );
      expect(builder.getDomainFolderName('/v1/admissions/applicants', [])).toBe(
        '4. Admissions & Registration',
      );
      expect(builder.getDomainFolderName('/v1/admissions/masters/quotas', [])).toBe(
        '5. Admissions Masters',
      );
    });
  });

  describe('RequestBuilder', () => {
    it('should format enterprise request names and path variables', () => {
      const builder = new RequestBuilder();
      const item = {
        name: 'Register applicant',
        request: {
          method: 'POST',
          url: {
            raw: 'http://localhost:3000/v1/admissions/applicants',
          },
        },
      };

      const formatted = builder.formatRequestItem(item);
      expect(formatted.name).toBe('Create Applicant');
    });
  });

  describe('EnvironmentGenerator', () => {
    it('should discover all variables and output Postman environment structure', () => {
      const generator = new EnvironmentGenerator();
      const env = generator.generateEnvironment(mockSwaggerDoc, 'http://localhost:3000');

      expect(env.name).toBe('School ERP Environment');
      const keys = env.values.map((v) => v.key);

      expect(keys).toContain('baseUrl');
      expect(keys).toContain('accessToken');
      expect(keys).toContain('branchId');
      expect(keys).toContain('applicantId');
      expect(keys).toContain('genderId');
    });
  });
});
