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

    this.inspectItems(collection.item, warnings, errors, 'Root');

    return {
      valid: errors.length === 0,
      warnings,
      errors,
    };
  }

  private inspectItems(items: any[], warnings: string[], errors: string[], parentContext: string) {
    const folderNames = new Set<string>();
    const requestNames = new Set<string>();

    for (const item of items) {
      const name = item.name || 'Unnamed';

      if (item.item && Array.isArray(item.item)) {
        // Folder node
        if (folderNames.has(name)) {
          warnings.push(`[Duplicate Folder Warning] Duplicate folder "${name}" found under "${parentContext}".`);
        }
        folderNames.add(name);

        this.inspectItems(item.item, warnings, errors, `${parentContext} > ${name}`);
      } else if (item.request) {
        // Request node
        if (requestNames.has(name)) {
          warnings.push(`[Duplicate Request Warning] Duplicate request name "${name}" found under "${parentContext}".`);
        }
        requestNames.add(name);

        const req = item.request;
        const method = (req.method || 'GET').toUpperCase();

        // 1. Check body for POST/PATCH/PUT
        if (['POST', 'PATCH', 'PUT'].includes(method)) {
          if (!req.body || !req.body.raw || req.body.raw.trim() === '{}' || req.body.raw.trim() === '') {
            warnings.push(`[Empty Body Warning] Request "${name}" (${method}) under "${parentContext}" has an empty request body.`);
          }
        }

        // 2. Check for raw :id in URL
        const rawUrl = req.url?.raw || (typeof req.url === 'string' ? req.url : '');
        if (rawUrl.includes(':id') && !req.url?.variable?.some((v: any) => v.key === 'id')) {
          warnings.push(`[Path Variable Warning] Request "${name}" under "${parentContext}" contains raw ":id" in URL.`);
        }
      }
    }
  }
}
