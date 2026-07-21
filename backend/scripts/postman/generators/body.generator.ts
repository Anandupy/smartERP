import { OpenApiParser, OpenApiSchema } from '../parsers/openapi.parser';

export class BodyGenerator {
  constructor(private parser: OpenApiParser) {}

  /**
   * Generate a formatted 2-space JSON string for a given OpenAPI schema or $ref
   */
  generateJsonBody(schema: OpenApiSchema): string {
    const resolved = this.parser.resolveFullSchema(schema);
    const objectVal = this.generateSampleObject(resolved);
    return JSON.stringify(objectVal, null, 2);
  }

  /**
   * Generate a sample JS value for any schema
   */
  private generateSampleObject(schema: OpenApiSchema): any {
    if (!schema) return {};

    // 1. If explicit example exists, prioritize it
    if (schema.example !== undefined && schema.example !== null) {
      return schema.example;
    }

    // 2. Enum handling
    if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
      return schema.enum[0];
    }

    // 3. Type-based resolution
    const type = schema.type || 'object';

    if (type === 'object' || schema.properties) {
      const result: Record<string, any> = {};
      const props = schema.properties || {};

      for (const [propName, propSchema] of Object.entries(props)) {
        result[propName] = this.generatePropertyValue(propName, propSchema);
      }

      return result;
    }

    if (type === 'array') {
      const itemSchema = schema.items
        ? this.parser.resolveFullSchema(schema.items)
        : {};
      return [this.generatePropertyValue('item', itemSchema)];
    }

    return this.generatePropertyValue('field', schema);
  }

  /**
   * Generate property value based on property name, type, and semantic faking
   */
  generatePropertyValue(propName: string, propSchema: OpenApiSchema): any {
    const resolved = this.parser.resolveFullSchema(propSchema);

    // 1. Priority 1: Explicit example or default in schema
    if (resolved.example !== undefined && resolved.example !== null) {
      return resolved.example;
    }
    if (resolved.default !== undefined && resolved.default !== null) {
      return resolved.default;
    }

    // 2. Priority 2: UUID Detection (*Id or id)
    if (
      propName === 'id' ||
      propName.endsWith('Id') ||
      propName.endsWith('ID')
    ) {
      // Return Postman variable: e.g. {{branchId}}, {{genderId}}
      return `{{${propName}}}`;
    }

    // 3. Enum handling
    if (resolved.enum && Array.isArray(resolved.enum) && resolved.enum.length > 0) {
      return resolved.enum[0];
    }

    const type = resolved.type || 'string';

    if (type === 'boolean') {
      return true;
    }

    if (type === 'number' || type === 'integer') {
      if (propName.toLowerCase().includes('percentage') || propName.toLowerCase().includes('income')) {
        return 85.5;
      }
      return 1;
    }

    if (type === 'array') {
      const itemSchema = resolved.items
        ? this.parser.resolveFullSchema(resolved.items)
        : {};
      return [this.generatePropertyValue(`${propName}Item`, itemSchema)];
    }

    if (type === 'object') {
      if (resolved.properties) {
        return this.generateSampleObject(resolved);
      }
      return { sampleKey: 'sampleValue' };
    }

    // 4. Semantic String Faking
    const lowerName = propName.toLowerCase();

    if (lowerName.includes('email')) {
      return 'john.doe@example.com';
    }
    if (lowerName.includes('mobile') || lowerName.includes('phone')) {
      return '9876543210';
    }
    if (propName === 'firstName') return 'John';
    if (propName === 'middleName') return 'Michael';
    if (propName === 'lastName') return 'Doe';
    if (propName === 'displayName' || propName === 'fullName') return 'John Doe';
    if (lowerName === 'city') return 'Mumbai';
    if (lowerName === 'state') return 'Maharashtra';
    if (lowerName === 'country') return 'India';
    if (lowerName === 'pincode') return '400001';
    if (lowerName.includes('addressline1')) return '123 Education Lane';
    if (lowerName.includes('addressline2')) return 'Suite 400';
    if (propName === 'dob' || lowerName.includes('dateofbirth')) return '2008-06-15';
    if (lowerName.includes('startdate')) return '2026-04-01';
    if (lowerName.includes('enddate')) return '2027-03-31';
    if (lowerName.includes('aadhaar')) return '123456789012';
    if (lowerName.includes('penno')) return 'PEN123456789';
    if (lowerName.includes('apaar')) return 'APAAR987654321';
    if (lowerName === 'code' || lowerName.includes('code')) return 'HHS-001';
    if (lowerName === 'name' || lowerName.includes('name')) return 'Sample Resource Name';
    if (lowerName.includes('password')) return 'Password123!';
    if (lowerName.includes('username') || lowerName.includes('identifier')) return 'admin_user';

    return 'Sample Value';
  }
}
