import {
  OpenApiParser,
  OpenApiDocument,
} from '@/../scripts/postman/parsers/openapi.parser';
import { BodyGenerator } from '@/../scripts/postman/generators/body.generator';
import { FolderBuilder } from '@/../scripts/postman/builders/folder.builder';
import { RequestBuilder } from '@/../scripts/postman/builders/request.builder';
import { EnvironmentGenerator } from '@/../scripts/postman/generators/environment.generator';

describe('Postman Generator Engine v2 (Hierarchical Structure)', () => {
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
        patch: {
          summary: 'Update applicant details',
        },
        delete: {
          summary: 'Soft delete applicant',
        },
      },
      '/v1/admissions/masters/quotas': {
        post: {
          summary: 'Create a quota',
          tags: ['Admissions Masters: Quota'],
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

      const resolved = parser.resolveRef(
        '#/components/schemas/CreateApplicantDto',
      );
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
    it('should build hierarchical Domain -> Controller folder paths', () => {
      const builder = new FolderBuilder();

      expect(
        builder.getFolderPath('/v1/auth/login', ['Authentication']),
      ).toEqual(['Authentication', 'Authentication']);
      expect(builder.getFolderPath('/v1/branches', ['Branches'])).toEqual([
        'Administration',
        'Branch',
      ]);
      expect(
        builder.getFolderPath('/v1/academic-years', ['Academic Years']),
      ).toEqual(['Academic', 'Academic Year']);
      expect(
        builder.getFolderPath('/v1/admissions/applicants', ['Applicants']),
      ).toEqual(['Admissions', 'Applicant']);
      expect(
        builder.getFolderPath('/v1/admissions/masters/quotas', [
          'Admissions Masters: Quota',
        ]),
      ).toEqual(['Admissions', 'Masters', 'Quota']);
      expect(builder.getFolderPath('/v1/finance/fees', ['Fees'])).toEqual([
        'Finance',
        'Fee',
      ]);
    });

    it('should order requests in standard CRUD order (Create, List, Get, Update, Delete)', () => {
      const builder = new FolderBuilder();
      builder.reset();

      const reqPost = {
        name: 'Register Applicant',
        request: { method: 'POST', url: { raw: '/v1/admissions/applicants' } },
      };
      const reqGetList = {
        name: 'List Applicants',
        request: { method: 'GET', url: { raw: '/v1/admissions/applicants' } },
      };
      const reqGetId = {
        name: 'Get Applicant by ID',
        request: {
          method: 'GET',
          url: { raw: '/v1/admissions/applicants/:id' },
        },
      };
      const reqPatch = {
        name: 'Update Applicant',
        request: {
          method: 'PATCH',
          url: { raw: '/v1/admissions/applicants/:id' },
        },
      };
      const reqDelete = {
        name: 'Delete Applicant',
        request: {
          method: 'DELETE',
          url: { raw: '/v1/admissions/applicants/:id' },
        },
      };

      // Insert out of order
      builder.addRequest(reqPatch, ['Applicants']);
      builder.addRequest(reqDelete, ['Applicants']);
      builder.addRequest(reqGetId, ['Applicants']);
      builder.addRequest(reqPost, ['Applicants']);
      builder.addRequest(reqGetList, ['Applicants']);

      const items = builder.buildCollectionItems();
      const admissionsFolder = items.find((i: any) => i.name === 'Admissions');
      expect(admissionsFolder).toBeDefined();

      const applicantFolder = admissionsFolder.item.find(
        (i: any) => i.name === 'Applicant',
      );
      expect(applicantFolder).toBeDefined();

      const requestNames = applicantFolder.item.map((r: any) => r.name);
      expect(requestNames).toEqual([
        'Register Applicant',
        'List Applicants',
        'Get Applicant by ID',
        'Update Applicant',
        'Delete Applicant',
      ]);
    });
  });

  describe('RequestBuilder', () => {
    it('should format enterprise request names using Swagger summary priority', () => {
      const builder = new RequestBuilder();

      const item1 = {
        name: 'default',
        request: {
          method: 'POST',
          url: { raw: 'http://localhost:3000/v1/admissions/applicants' },
        },
      };
      const formatted1 = builder.formatRequestItem(item1, {
        summary: 'Register a new applicant',
      });
      expect(formatted1.name).toBe('Register Applicant');

      const item2 = {
        name: 'default',
        request: {
          method: 'GET',
          url: { raw: 'http://localhost:3000/v1/admissions/applicants' },
        },
      };
      const formatted2 = builder.formatRequestItem(item2, {
        summary:
          'Get all applicants for branch and academic year (filtered/paged)',
      });
      expect(formatted2.name).toBe('List Applicants');

      const item3 = {
        name: 'default',
        request: {
          method: 'GET',
          url: { raw: 'http://localhost:3000/v1/admissions/applicants/:id' },
        },
      };
      const formatted3 = builder.formatRequestItem(item3, {
        summary: 'Get applicant details by ID',
      });
      expect(formatted3.name).toBe('Get Applicant by ID');
    });
  });

  describe('EnvironmentGenerator', () => {
    it('should discover all variables and output Postman environment structure', () => {
      const generator = new EnvironmentGenerator();
      const env = generator.generateEnvironment(
        mockSwaggerDoc,
        'http://localhost:3000',
      );

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
