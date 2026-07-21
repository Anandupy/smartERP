/**
 * OpenAPI Schema Parser
 * Extracts and resolves component schemas, DTO models, and $ref references from Swagger JSON.
 */

export interface OpenApiSchema {
  type?: string;
  format?: string;
  description?: string;
  example?: any;
  default?: any;
  enum?: any[];
  properties?: Record<string, OpenApiSchema>;
  items?: OpenApiSchema;
  required?: string[];
  $ref?: string;
  allOf?: OpenApiSchema[];
  oneOf?: OpenApiSchema[];
  anyOf?: OpenApiSchema[];
  [key: string]: any;
}

export interface OpenApiDocument {
  openapi?: string;
  swagger?: string;
  info?: any;
  paths?: Record<string, any>;
  components?: {
    schemas?: Record<string, OpenApiSchema>;
    [key: string]: any;
  };
  [key: string]: any;
}

export class OpenApiParser {
  private schemas: Record<string, OpenApiSchema> = {};

  constructor(private doc: OpenApiDocument) {
    if (doc?.components?.schemas) {
      this.schemas = doc.components.schemas;
    }
  }

  /**
   * Get all registered DTO schemas
   */
  getSchemas(): Record<string, OpenApiSchema> {
    return this.schemas;
  }

  /**
   * Get a schema by component name (e.g. "CreateApplicantDto")
   */
  getSchemaByName(name: string): OpenApiSchema | null {
    return this.schemas[name] || null;
  }

  /**
   * Resolve a $ref URI (e.g. "#/components/schemas/CreateApplicantDto")
   */
  resolveRef(refUri: string): OpenApiSchema | null {
    if (!refUri || !refUri.startsWith('#/components/schemas/')) {
      return null;
    }
    const schemaName = refUri.replace('#/components/schemas/', '');
    return this.getSchemaByName(schemaName);
  }

  /**
   * Deeply resolve a schema object, following $ref and allOf if present
   */
  resolveFullSchema(schema: OpenApiSchema): OpenApiSchema {
    if (!schema) return {};

    if (schema.$ref) {
      const resolved = this.resolveRef(schema.$ref);
      if (resolved) {
        return this.resolveFullSchema(resolved);
      }
    }

    if (schema.allOf && Array.isArray(schema.allOf)) {
      const mergedProps: Record<string, OpenApiSchema> = {};
      const mergedRequired: string[] = [];

      for (const subSchema of schema.allOf) {
        const resolvedSub = this.resolveFullSchema(subSchema);
        if (resolvedSub.properties) {
          Object.assign(mergedProps, resolvedSub.properties);
        }
        if (resolvedSub.required) {
          mergedRequired.push(...resolvedSub.required);
        }
      }

      return {
        ...schema,
        type: 'object',
        properties: mergedProps,
        required: Array.from(new Set(mergedRequired)),
      };
    }

    return schema;
  }
}
