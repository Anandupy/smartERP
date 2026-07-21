export class RequestBuilder {
  /**
   * Refine and format an individual Postman request item
   */
  formatRequestItem(item: any): any {
    if (!item.request) return item;

    const request = item.request;
    const method = request.method || 'GET';
    const rawUrl = request.url?.raw || (typeof request.url === 'string' ? request.url : '');

    // 1. Clean Enterprise Request Name
    item.name = this.generateEnterpriseName(item.name, method, rawUrl);

    // 2. Path Variable Resolution (:id or :param -> {{param}})
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
   * Generate a clean enterprise action name for a request
   */
  private generateEnterpriseName(originalName: string, method: string, url: string): string {
    const lowerUrl = url.toLowerCase();

    // Specific Action Overrides
    if (lowerUrl.includes('/auth/login')) return 'User Login';
    if (lowerUrl.includes('/auth/refresh')) return 'Refresh Token';
    if (lowerUrl.includes('/auth/logout')) return 'User Logout';
    if (lowerUrl.includes('/auth/sessions')) {
      if (method === 'GET') return 'Get Active User Sessions';
      if (method === 'DELETE') return 'Revoke Session';
    }

    if (lowerUrl.includes('/academic-years/current')) return 'Get Current Academic Year';
    if (lowerUrl.includes('/academic-years/') && lowerUrl.includes('/select')) return 'Select Academic Year (Set Current)';
    if (lowerUrl.includes('/academic-years/') && lowerUrl.includes('/activate')) return 'Activate Academic Year';
    if (lowerUrl.includes('/academic-years/') && lowerUrl.includes('/lock')) return 'Lock Academic Year';

    if (lowerUrl.includes('/check-duplicates')) return 'Check Duplicate Applicant Records';
    if (lowerUrl.includes('/workflow/transition')) return 'Transition Applicant Workflow Status';
    if (lowerUrl.includes('/workflow/history')) return 'Get Workflow Transition History';

    if (lowerUrl.includes('/guardians/search')) return 'Search Guardians by Mobile/Aadhaar/Name';
    if (lowerUrl.includes('/guardians/applicant/') && lowerUrl.includes('/map')) return 'Map Guardian to Applicant';

    // Generic CRUD Naming Matrix
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
        return originalName;
    }
  }

  /**
   * Extract a human-readable resource name from URL path
   */
  private extractResourceName(url: string): string {
    const segments = url.split('?')[0].split('/').filter(Boolean);
    let last = '';
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      if (seg && !seg.startsWith(':') && !seg.startsWith('{') && !seg.startsWith('{{') && seg !== 'v1') {
        last = seg;
        break;
      }
    }

    if (!last) return 'Resource';

    // Plural to Singular conversion
    let singular = last;
    if (singular.endsWith('ies')) singular = singular.slice(0, -3) + 'y';
    else if (singular.endsWith('s') && !singular.endsWith('ss')) singular = singular.slice(0, -1);

    // Kebab to Title Case
    return singular
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Convert path parameters :id into {{resourceId}}
   */
  private formatUrlParameters(urlObj: any) {
    if (urlObj.variable && Array.isArray(urlObj.variable)) {
      for (const v of urlObj.variable) {
        const key = v.key;
        if (key === 'id') {
          // Infer specific variable from path context if possible
          const pathStr = Array.isArray(urlObj.path) ? urlObj.path.join('/') : '';
          if (pathStr.includes('applicants')) v.value = '{{applicantId}}';
          else if (pathStr.includes('academic-years')) v.value = '{{academicYearId}}';
          else if (pathStr.includes('branches')) v.value = '{{branchId}}';
          else if (pathStr.includes('organizations')) v.value = '{{organizationId}}';
          else if (pathStr.includes('programs')) v.value = '{{programId}}';
          else if (pathStr.includes('academic-units')) v.value = '{{academicUnitId}}';
          else if (pathStr.includes('guardians')) v.value = '{{guardianId}}';
          else v.value = '{{id}}';
        } else {
          v.value = `{{${key}}}`;
        }
      }
    }
  }

  /**
   * Format query parameters with realistic defaults
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
