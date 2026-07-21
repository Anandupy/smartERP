import { extractUrlString } from './request.builder';

export class FolderBuilder {
  private tree: Map<string, any> = new Map();

  /**
   * Reset the tree builder
   */
  reset() {
    this.tree.clear();
  }

  /**
   * Add a request item to the folder tree based on its URL path and tags
   */
  addRequest(requestItem: any, tags: string[] = []) {
    const rawUrl = extractUrlString(requestItem.request?.url);
    const folderPath = this.getFolderPath(rawUrl, tags);
    this.insertIntoTree(folderPath, requestItem);
  }

  /**
   * Determine the folder path array for an endpoint
   * e.g. ['Admissions', 'Applicant'] or ['Admissions', 'Masters', 'Quota']
   */
  getFolderPath(urlPath: string, tags: string[] = []): string[] {
    const cleanUrl = urlPath.split('?')[0];

    let relativePath = cleanUrl;
    if (relativePath.includes('://')) {
      try {
        const parsed = new URL(relativePath);
        relativePath = parsed.pathname;
      } catch (e) {}
    }
    if (relativePath.startsWith('/v1')) {
      relativePath = relativePath.replace('/v1', '');
    }

    const primaryTag = tags.length > 0 ? tags[0] : '';

    // 1. Authentication
    if (
      relativePath.startsWith('/auth') ||
      relativePath.startsWith('/users') ||
      primaryTag.toLowerCase().includes('auth') ||
      primaryTag.toLowerCase().includes('user')
    ) {
      const moduleName =
        relativePath.startsWith('/users') || primaryTag.toLowerCase().includes('user')
          ? 'User'
          : 'Authentication';
      return ['Authentication', moduleName];
    }

    // 2. Organization & Campus Administration
    if (
      relativePath.startsWith('/organizations') ||
      relativePath.startsWith('/branches') ||
      relativePath.startsWith('/system-settings') ||
      primaryTag.toLowerCase().includes('organization') ||
      primaryTag.toLowerCase().includes('branch') ||
      primaryTag.toLowerCase().includes('system')
    ) {
      let moduleName = 'Branch';
      if (relativePath.startsWith('/organizations') || primaryTag.toLowerCase().includes('organization')) {
        moduleName = 'Organization';
      } else if (relativePath.startsWith('/system-settings') || primaryTag.toLowerCase().includes('system')) {
        moduleName = 'System Settings';
      }
      return ['Administration', moduleName];
    }

    // 3. Academic Management
    if (
      relativePath.startsWith('/academic-years') ||
      relativePath.startsWith('/programs') ||
      relativePath.startsWith('/academic-units') ||
      primaryTag.toLowerCase().includes('academic') ||
      primaryTag.toLowerCase().includes('program')
    ) {
      let moduleName = 'Program';
      if (relativePath.startsWith('/academic-years') || primaryTag.toLowerCase().includes('academic year')) {
        moduleName = 'Academic Year';
      } else if (relativePath.startsWith('/academic-units') || primaryTag.toLowerCase().includes('unit')) {
        moduleName = 'Academic Unit';
      }
      return ['Academic', moduleName];
    }

    // 4. Admissions & Admissions Masters
    if (
      relativePath.startsWith('/admissions') ||
      primaryTag.toLowerCase().includes('admission') ||
      primaryTag.toLowerCase().includes('applicant') ||
      primaryTag.toLowerCase().includes('guardian') ||
      primaryTag.toLowerCase().includes('master')
    ) {
      // Admissions Masters check
      if (relativePath.startsWith('/admissions/masters') || primaryTag.includes('Admissions Masters')) {
        let masterName = '';
        if (primaryTag.includes(':')) {
          masterName = primaryTag.split(':')[1].trim();
        } else {
          const segs = relativePath.split('/').filter(Boolean);
          const lastSeg = segs[segs.length - 1] || 'Master';
          masterName = this.formatModuleName(lastSeg);
        }
        return ['Admissions', 'Masters', masterName];
      }

      // Specific Admissions Modules
      if (relativePath.includes('/applicants') && relativePath.includes('/enrollment')) {
        return ['Admissions', 'Enrollment'];
      }
      if (relativePath.includes('/applicants') && relativePath.includes('/workflow')) {
        return ['Admissions', 'Workflow'];
      }
      if (relativePath.includes('/applicants') || primaryTag.toLowerCase().includes('applicant')) {
        return ['Admissions', 'Applicant'];
      }
      if (relativePath.includes('/guardians') || primaryTag.toLowerCase().includes('guardian')) {
        return ['Admissions', 'Guardian'];
      }
      if (relativePath.includes('/numbering') || primaryTag.toLowerCase().includes('numbering')) {
        return ['Admissions', 'Numbering'];
      }

      const moduleName = primaryTag ? this.formatModuleName(primaryTag) : 'General';
      return ['Admissions', moduleName];
    }

    // 5. Dynamic Fallback for Future Modules (e.g., /v1/finance/fees -> ['Finance', 'Fee'])
    const segments = relativePath
      .split('/')
      .filter((s) => s && !s.startsWith(':') && !s.startsWith('{') && !s.startsWith('{{'));

    if (segments.length >= 2) {
      const domain = this.formatModuleName(segments[0]);
      const moduleName = this.formatModuleName(segments[1]);
      return [domain, moduleName];
    } else if (segments.length === 1) {
      const domain = this.formatModuleName(segments[0]);
      return [domain, domain];
    }

    return ['Other Operations', 'General'];
  }

  /**
   * Helper to format tag or route segment into Title Case singular module name
   */
  private formatModuleName(name: string): string {
    let clean = name.trim();
    if (clean.endsWith('ies')) clean = clean.slice(0, -3) + 'y';
    else if (clean.endsWith('es') && (clean.endsWith('ches') || clean.endsWith('shes') || clean.endsWith('xes'))) clean = clean.slice(0, -2);
    else if (clean.endsWith('s') && !clean.endsWith('ss') && !clean.endsWith('is') && !clean.endsWith('us')) clean = clean.slice(0, -1);

    return clean
      .split(/[-_\s]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  /**
   * Insert a request node into the tree at folderPath
   */
  private insertIntoTree(folderPath: string[], requestItem: any) {
    let currentMap = this.tree;

    for (let i = 0; i < folderPath.length; i++) {
      const folderName = folderPath[i];
      if (!currentMap.has(folderName)) {
        currentMap.set(folderName, {
          name: folderName,
          children: new Map<string, any>(),
          requests: [] as any[],
        });
      }

      const node = currentMap.get(folderName);
      if (i === folderPath.length - 1) {
        node.requests.push(requestItem);
      } else {
        currentMap = node.children;
      }
    }
  }

  /**
   * Build the complete sorted Postman collection item array
   */
  buildCollectionItems(): any[] {
    return this.convertMapToArray(this.tree, 0);
  }

  private convertMapToArray(map: Map<string, any>, depth: number): any[] {
    const domainOrder = ['Authentication', 'Administration', 'Academic', 'Admissions'];
    const admissionsModuleOrder = ['Applicant', 'Guardian', 'Enrollment', 'Workflow', 'Numbering', 'Masters'];

    const sortedKeys = Array.from(map.keys()).sort((a, b) => {
      if (depth === 0) {
        const indexA = domainOrder.indexOf(a);
        const indexB = domainOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
      } else if (depth === 1) {
        const indexA = admissionsModuleOrder.indexOf(a);
        const indexB = admissionsModuleOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
      }
      return a.localeCompare(b);
    });

    const result: any[] = [];

    for (const key of sortedKeys) {
      const node = map.get(key);
      const folderItem: any = {
        name: node.name,
        item: [],
      };

      // Sub-folders first
      if (node.children.size > 0) {
        const childFolders = this.convertMapToArray(node.children, depth + 1);
        folderItem.item.push(...childFolders);
      }

      // Request items next, sorted by CRUD order
      if (node.requests.length > 0) {
        const sortedRequests = this.sortRequests(node.requests);
        folderItem.item.push(...sortedRequests);
      }

      result.push(folderItem);
    }

    return result;
  }

  /**
   * Sort requests within a module folder in standard CRUD order:
   * 1. Create (POST)
   * 2. List (GET without param)
   * 3. Get (GET with param)
   * 4. Update (PATCH/PUT)
   * 5. Delete (DELETE)
   * 6. Custom action endpoints
   */
  private sortRequests(requests: any[]): any[] {
    return requests.sort((a, b) => {
      const weightA = this.getRequestWeight(a);
      const weightB = this.getRequestWeight(b);

      if (weightA !== weightB) {
        return weightA - weightB;
      }

      return (a.name || '').localeCompare(b.name || '');
    });
  }

  private getRequestWeight(item: any): number {
    const method = (item.request?.method || 'GET').toUpperCase();
    const rawUrl = item.request?.url?.raw || (typeof item.request?.url === 'string' ? item.request?.url : '');
    const hasPathParam = rawUrl.includes(':') || rawUrl.includes('{') || rawUrl.includes('{{');
    const name = (item.name || '').toLowerCase();

    if (method === 'POST') {
      if (name.startsWith('create') || name.startsWith('register')) return 10;
      return 60;
    }

    if (method === 'GET') {
      if (name.startsWith('list') || (!hasPathParam && !name.includes('search') && !name.includes('tree'))) return 20;
      if (name.startsWith('get') || hasPathParam) return 30;
      return 60;
    }

    if (method === 'PATCH' || method === 'PUT') {
      if (name.startsWith('update')) return 40;
      return 60;
    }

    if (method === 'DELETE') {
      return 50;
    }

    return 70;
  }
}
