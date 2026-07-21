import { OpenApiDocument } from '../parsers/openapi.parser';

export interface PostmanEnvValue {
  key: string;
  value: string;
  enabled: boolean;
}

export interface PostmanEnvironment {
  id: string;
  name: string;
  values: PostmanEnvValue[];
  _postman_variable_scope: string;
  _postman_exported_at: string;
  _postman_exported_using: string;
}

export class EnvironmentGenerator {
  /**
   * Automatically discover all variables and construct Postman environment JSON
   */
  generateEnvironment(doc: OpenApiDocument, baseUrl: string): PostmanEnvironment {
    const variableSet = new Set<string>([
      'baseUrl',
      'accessToken',
      'tenantId',
      'organizationId',
      'branchId',
      'academicYearId',
    ]);

    // Discover variables from OpenAPI paths and components
    if (doc?.paths) {
      for (const [pathUrl, pathItem] of Object.entries(doc.paths)) {
        // Path parameters (e.g. /admissions/applicants/{applicantId})
        const pathMatches = pathUrl.match(/\{([^}]+)\}/g) || pathUrl.match(/:([a-zA-Z0-9_]+)/g);
        if (pathMatches) {
          for (const match of pathMatches) {
            const varName = match.replace(/[\{:\}]/g, '');
            variableSet.add(varName);
          }
        }
      }
    }

    if (doc?.components?.schemas) {
      for (const schema of Object.values(doc.components.schemas)) {
        if (schema.properties) {
          for (const propName of Object.keys(schema.properties)) {
            if (propName === 'id' || propName.endsWith('Id') || propName.endsWith('ID')) {
              variableSet.add(propName);
            }
          }
        }
      }
    }

    const values: PostmanEnvValue[] = Array.from(variableSet).map((key) => ({
      key,
      value: key === 'baseUrl' ? baseUrl : '',
      enabled: true,
    }));

    return {
      id: 'erp-environment-id',
      name: 'School ERP Environment',
      values,
      _postman_variable_scope: 'environment',
      _postman_exported_at: new Date().toISOString(),
      _postman_exported_using: 'CampusFlow ERP Generator v2',
    };
  }
}
