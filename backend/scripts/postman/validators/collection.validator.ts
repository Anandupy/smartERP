export class CollectionValidator {
  /**
   * Validate the Postman collection integrity and enforce enterprise build quality
   */
  validateCollection(collection: any): {
    valid: boolean;
    warnings: string[];
    errors: string[];
  } {
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

  private inspectItems(
    items: any[],
    warnings: string[],
    errors: string[],
    parentContext: string,
  ) {
    const folderNames = new Set<string>();
    const requestNames = new Set<string>();

    for (const item of items) {
      const name = item.name || 'Unnamed';

      if (item.item && Array.isArray(item.item)) {
        // Folder node
        if (folderNames.has(name)) {
          errors.push(
            `Duplicate Folder Error: Duplicate folder "${name}" found under "${parentContext}".`,
          );
        }
        folderNames.add(name);

        this.inspectItems(
          item.item,
          warnings,
          errors,
          `${parentContext} > ${name}`,
        );
      } else if (item.request) {
        // Request node
        if (requestNames.has(name)) {
          errors.push(
            `Duplicate Request Error: Duplicate request name "${name}" found under "${parentContext}".`,
          );
        }
        requestNames.add(name);

        // 1. Generic Name Verification
        if (
          name.includes('Item') ||
          name.includes('Resource') ||
          name.includes('Object') ||
          name === 'Unnamed'
        ) {
          errors.push(
            `Generic Request Name Error: Request "${name}" under "${parentContext}" has an unacceptable generic name.`,
          );
        }

        const req = item.request;
        const method = (req.method || 'GET').toUpperCase();

        // 2. Empty Body Verification for POST/PATCH/PUT expecting a body
        if (['POST', 'PATCH', 'PUT'].includes(method)) {
          // If request body mode is raw, check if it's empty
          if (req.body && req.body.mode === 'raw') {
            const rawBody = (req.body.raw || '').trim();
            if (rawBody === '{}' || rawBody === '') {
              errors.push(
                `Empty Body Error: Request "${name}" (${method}) under "${parentContext}" has an empty request body.`,
              );
            }
          }
        }

        // 3. Unhandled Raw Parameter Check
        const rawUrl =
          req.url?.raw || (typeof req.url === 'string' ? req.url : '');
        if (
          rawUrl.includes(':id') &&
          !req.url?.variable?.some((v: any) => v.key === 'id')
        ) {
          warnings.push(
            `Path Variable Warning: Request "${name}" under "${parentContext}" contains raw ":id" in URL.`,
          );
        }
      }
    }
  }
}
