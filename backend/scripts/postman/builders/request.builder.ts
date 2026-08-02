export function extractUrlString(url: any): string {
  if (!url) return '';
  if (typeof url === 'string') return url;
  if (url.raw) return url.raw;
  if (url.path) {
    const pathStr = Array.isArray(url.path) ? url.path.join('/') : url.path;
    return '/' + pathStr;
  }
  return '';
}

export class RequestBuilder {
  /**
   * Refine and format an individual Postman request item using OpenAPI operation metadata
   */
  formatRequestItem(item: any, operation?: any): any {
    if (!item.request) return item;

    const request = item.request;
    const method = (request.method || 'GET').toUpperCase();
    const rawUrl = extractUrlString(request.url);

    // 1. Clean Enterprise Request Name following exact priority order
    item.name = this.generateEnterpriseName(
      item.name,
      method,
      rawUrl,
      operation?.summary,
      operation?.operationId,
    );

    // 2. Path Variable Resolution (:id or {param} -> {{param}})
    if (request.url) {
      this.formatUrlParameters(request.url);
    }

    // 3. Query Parameter Formatting
    if (request.url?.query && Array.isArray(request.url.query)) {
      this.formatQueryParameters(request.url.query);
    }

    // 4. Header Sanitization & Verification
    if (request.header && Array.isArray(request.header)) {
      this.formatHeaders(request.header);
    }

    return item;
  }

  /**
   * Generate clean enterprise request name adhering to priority:
   * 1. Swagger summary
   * 2. Swagger operationId
   * 3. Controller name + HTTP method + route
   * 4. Route analysis
   */
  private generateEnterpriseName(
    originalName: string,
    method: string,
    url: string,
    summary?: string,
    operationId?: string,
  ): string {
    // Priority 1: Swagger Summary
    if (summary && summary.trim()) {
      const cleaned = this.cleanSwaggerSummary(summary, method, url);
      if (cleaned) return cleaned;
    }

    // Priority 2: Swagger operationId
    if (operationId && operationId.trim()) {
      const cleanedOp = this.cleanOperationId(operationId, method);
      if (cleanedOp) return cleanedOp;
    }

    // Priority 3 & 4: Route & Method Analysis
    return this.generateFromRoute(method, url, originalName);
  }

  /**
   * Priority 1: Clean Swagger summary into concise enterprise request name
   */
  private cleanSwaggerSummary(
    summary: string,
    method: string,
    url: string,
  ): string {
    let s = summary.trim();

    // Remove noise in parentheses
    s = s.replace(/\(filtered\/paged\)/gi, '');
    s = s.replace(/\(set as current\)/gi, '');
    s = s.replace(/\(ISO format\)/gi, '');
    s = s.replace(
      /\(search by primary mobile, aadhaar, or name\)/gi,
      'by Mobile/Aadhaar/Name',
    );

    // Standardize verbs
    s = s.replace(
      /^Get all (\w+) for (a branch|branch and academic year|branch)/gi,
      'List $1',
    );
    s = s.replace(/^Get all (\w+)/gi, 'List $1');
    s = s.replace(/^Get (\w+) details by ID/gi, 'Get $1 by ID');
    s = s.replace(/^Get (\w+) details/gi, 'Get $1');
    s = s.replace(/^Create a new /gi, 'Create ');
    s = s.replace(/^Create a /gi, 'Create ');
    s = s.replace(/^Register a new /gi, 'Register ');
    s = s.replace(/^Register a /gi, 'Register ');
    s = s.replace(/^Soft delete /gi, 'Delete ');
    s = s.replace(/^Toggle (\w+) status/gi, 'Toggle $1 Status');

    // Strip generic filler words (item, items, resource, resources, object, objects)
    s = s.replace(/\s+(item|items|resource|resources|object|objects)\b/gi, '');

    s = s.replace(/\s+/g, ' ').trim();

    if (s.length > 0) {
      return this.toTitleCase(s);
    }

    return '';
  }

  private toTitleCase(str: string): string {
    const lowercaseWords = new Set([
      'a',
      'an',
      'the',
      'for',
      'and',
      'nor',
      'but',
      'or',
      'yet',
      'so',
      'at',
      'by',
      'in',
      'of',
      'on',
      'to',
      'with',
    ]);
    const words = str.split(' ');

    return words
      .map((word, idx) => {
        if (
          idx > 0 &&
          lowercaseWords.has(word.toLowerCase()) &&
          !word.includes('/')
        ) {
          return word.toLowerCase();
        }
        if (word.includes('/')) {
          return word
            .split('/')
            .map((sub) => sub.charAt(0).toUpperCase() + sub.slice(1))
            .join('/');
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }

  /**
   * Priority 2: Convert NestJS operationId (e.g. ApplicantController_create_v1) into enterprise request name
   */
  private cleanOperationId(operationId: string, method: string): string {
    const match = operationId.match(/^([A-Za-z0-9]+)Controller_([A-Za-z0-9]+)/);
    if (match) {
      const controllerName = match[1];
      const actionName = match[2];

      let entity = controllerName;
      if (entity.endsWith('s') && !entity.endsWith('ss')) {
        entity = entity.slice(0, -1);
      }

      let action = actionName;
      if (action === 'create') action = 'Create';
      else if (action === 'findAll') action = 'List';
      else if (action === 'findOne') action = 'Get';
      else if (action === 'update') action = 'Update';
      else if (action === 'remove' || action === 'delete') action = 'Delete';
      else if (action === 'findCurrent') action = 'Get Current';
      else if (action === 'getTree') action = 'Get Tree';
      else if (action === 'toggleStatus') action = 'Toggle Status';
      else if (action === 'checkDupes') action = 'Check Duplicates';
      else action = action.charAt(0).toUpperCase() + action.slice(1);

      if (action === 'List') {
        return `List ${entity}s`;
      }
      if (action === 'Get') {
        return `Get ${entity} by ID`;
      }
      return `${action} ${entity}`;
    }

    const words = operationId
      .replace(/Controller_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim();

    return words
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  /**
   * Priority 3 & 4: Route and Method fallback analysis
   */
  private generateFromRoute(
    method: string,
    url: string,
    originalName: string,
  ): string {
    const lowerUrl = url.toLowerCase();

    // Specific Endpoint Overrides
    if (lowerUrl.includes('/auth/login')) return 'User Login';
    if (lowerUrl.includes('/auth/refresh')) return 'Refresh Token';
    if (lowerUrl.includes('/auth/logout')) return 'User Logout';
    if (lowerUrl.includes('/auth/sessions')) {
      if (method === 'GET') return 'Get Active User Sessions';
      if (method === 'DELETE') return 'Revoke Session';
    }

    if (lowerUrl.includes('/academic-years/current'))
      return 'Get Current Academic Year';
    if (lowerUrl.includes('/academic-years/') && lowerUrl.includes('/select'))
      return 'Select Academic Year';
    if (lowerUrl.includes('/academic-years/') && lowerUrl.includes('/activate'))
      return 'Activate Academic Year';
    if (lowerUrl.includes('/academic-years/') && lowerUrl.includes('/lock'))
      return 'Lock Academic Year';

    if (lowerUrl.includes('/check-duplicates'))
      return 'Check Duplicate Applicant Records';
    if (lowerUrl.includes('/workflow/transition'))
      return 'Transition Applicant Workflow Status';
    if (lowerUrl.includes('/workflow/history'))
      return 'Get Workflow Transition History';

    if (lowerUrl.includes('/guardians/search'))
      return 'Search Guardians by Mobile/Aadhaar/Name';
    if (lowerUrl.includes('/guardians/applicant/') && lowerUrl.includes('/map'))
      return 'Map Guardian to Applicant';

    const resourceName = this.extractResourceName(url);

    switch (method) {
      case 'POST':
        return `Create ${resourceName}`;
      case 'GET':
        if (url.includes(':') || url.includes('{')) {
          return `Get ${resourceName} by ID`;
        }
        return `List ${resourceName}s`;
      case 'PATCH':
      case 'PUT':
        return `Update ${resourceName}`;
      case 'DELETE':
        return `Delete ${resourceName}`;
      default:
        return originalName || `${method} ${resourceName}`;
    }
  }

  /**
   * Extract human-readable resource name from URL path
   */
  private extractResourceName(url: string): string {
    let clean = url.split('?')[0].trim();
    clean = clean
      .replace(/^https?:\/\/[^\/]+/i, '')
      .replace(/^\{\{[^}]+\}\}/i, '');

    const segments = clean
      .split('/')
      .filter(
        (s) =>
          s &&
          !s.startsWith(':') &&
          !s.startsWith('{') &&
          !s.startsWith('{{') &&
          s !== 'v1',
      );

    let last = '';
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      if (
        seg &&
        seg !== 'status' &&
        seg !== 'tree' &&
        seg !== 'select' &&
        seg !== 'activate' &&
        seg !== 'lock'
      ) {
        last = seg;
        break;
      }
    }

    if (!last && segments.length > 0) {
      last = segments[0];
    }

    if (!last || last === 'Item' || last === 'Resource') {
      return 'Entity';
    }

    let singular = last;
    if (singular.endsWith('ies')) singular = singular.slice(0, -3) + 'y';
    else if (singular.endsWith('s') && !singular.endsWith('ss')) {
      singular = singular.slice(0, -1);
    }

    return singular
      .split(/[-_\s]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Convert path parameters :id or {param} into {{param}}
   */
  private formatUrlParameters(urlObj: any) {
    if (urlObj.variable && Array.isArray(urlObj.variable)) {
      for (const v of urlObj.variable) {
        const key = v.key;
        if (key === 'id') {
          const pathStr = Array.isArray(urlObj.path)
            ? urlObj.path.join('/')
            : '';
          if (pathStr.includes('applicants')) v.value = '{{applicantId}}';
          else if (pathStr.includes('academic-years'))
            v.value = '{{academicYearId}}';
          else if (pathStr.includes('branches')) v.value = '{{branchId}}';
          else if (pathStr.includes('organizations'))
            v.value = '{{organizationId}}';
          else if (pathStr.includes('programs')) v.value = '{{programId}}';
          else if (pathStr.includes('academic-units'))
            v.value = '{{academicUnitId}}';
          else if (pathStr.includes('guardians')) v.value = '{{guardianId}}';
          else v.value = '{{id}}';
        } else {
          v.value = `{{${key}}}`;
        }
      }
    }
  }

  /**
   * Format query parameters with defaults
   */
  private formatQueryParameters(queryParams: any[]) {
    for (const q of queryParams) {
      const key = q.key;
      if (key === 'page') q.value = '1';
      else if (key === 'limit' || key === 'pageSize') q.value = '10';
      else if (key === 'sortBy') q.value = 'createdAt';
      else if (key === 'sortOrder') q.value = 'desc';
      else if (key === 'branchId') q.value = '{{branchId}}';
      else if (key === 'academicYearId') q.value = '{{academicYearId}}';
      else if (key === 'search' || key === 'q') q.value = '';
    }
  }

  /**
   * Ensure required headers map to Postman environment variables
   */
  private formatHeaders(headers: any[]) {
    for (const h of headers) {
      const key = h.key.toLowerCase();
      if (key === 'x-branch-id') h.value = '{{branchId}}';
      else if (key === 'x-academic-year-id') h.value = '{{academicYearId}}';
      else if (key === 'x-organization-id') h.value = '{{organizationId}}';
    }
  }
}
