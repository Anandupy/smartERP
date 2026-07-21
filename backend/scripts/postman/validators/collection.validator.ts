export class CollectionValidator {
  /**
   * Validate the Postman collection integrity
   */
  validateCollection(collection: any): { valid: boolean; warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!collection || !collection.item || !Array.isArray(collection.item)) {
      errors.push('Collection root item array is missing or invalid.');
      return { valid: false, warnings, errors };
    }

    this.inspectItems(collection.item, warnings, errors);

    return {
      valid: errors.length === 0,
      warnings,
      errors,
    };
  }

  private inspectItems(items: any[], warnings: string[], errors: string[]) {
    for (const item of items) {
      if (item.item && Array.isArray(item.item)) {
        // Folder node
        this.inspectItems(item.item, warnings, errors);
      } else if (item.request) {
        // Request node
        const req = item.request;
        const name = item.name || 'Unnamed Request';

        // 1. Check body for POST/PATCH/PUT
        const method = req.method || 'GET';
        if (['POST', 'PATCH', 'PUT'].includes(method)) {
          if (!req.body || !req.body.raw || req.body.raw.trim() === '{}' || req.body.raw.trim() === '') {
            warnings.push(`[Empty Body Warning] Request "${name}" (${method}) has an empty request body.`);
          }
        }

        // 2. Check for raw :id in URL
        const rawUrl = req.url?.raw || (typeof req.url === 'string' ? req.url : '');
        if (rawUrl.includes(':id') && !req.url?.variable?.some((v: any) => v.key === 'id')) {
          warnings.push(`[Path Variable Warning] Request "${name}" contains raw ":id" in URL.`);
        }
      }
    }
  }
}
