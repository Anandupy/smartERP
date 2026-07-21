export interface DomainFolderConfig {
  name: string;
  description: string;
  order: number;
  matchers: (urlPath: string, tags: string[]) => boolean;
}

export class FolderBuilder {
  private domainFolders: DomainFolderConfig[] = [
    {
      name: '1. Authentication & Session Management',
      description: 'User login, token refresh, logout, and session tracking endpoints',
      order: 1,
      matchers: (url, tags) =>
        url.includes('/auth') ||
        url.includes('/users') ||
        tags.some((t) => t.toLowerCase().includes('auth') || t.toLowerCase().includes('user')),
    },
    {
      name: '2. Organization & Campus Administration',
      description: 'Educational trust, branch management, and system-wide settings',
      order: 2,
      matchers: (url, tags) =>
        url.includes('/organizations') ||
        url.includes('/branches') ||
        url.includes('/system-settings') ||
        tags.some(
          (t) =>
            t.toLowerCase().includes('organization') ||
            t.toLowerCase().includes('branch') ||
            t.toLowerCase().includes('system'),
        ),
    },
    {
      name: '3. Academic Management',
      description: 'Academic Year cycles, course programs, and academic unit hierarchies',
      order: 3,
      matchers: (url, tags) =>
        url.includes('/academic-years') ||
        url.includes('/programs') ||
        url.includes('/academic-units') ||
        tags.some(
          (t) =>
            t.toLowerCase().includes('academic year') ||
            t.toLowerCase().includes('program') ||
            t.toLowerCase().includes('academic unit'),
        ),
    },
    {
      name: '5. Admissions Masters',
      description: 'Master lookup tables (quotas, religions, castes, categories, disabilities, genders, languages, blood groups, etc.)',
      order: 5,
      matchers: (url, tags) =>
        url.includes('/admissions/masters') ||
        tags.some((t) => t.toLowerCase().includes('masters')),
    },
    {
      name: '4. Admissions & Registration',
      description: 'Applicant registration, guardian mapping, enrollment placement, and state transitions',
      order: 4,
      matchers: (url, tags) =>
        url.includes('/admissions') ||
        tags.some((t) => t.toLowerCase().includes('applicant') || t.toLowerCase().includes('admission')),
    },
  ];

  /**
   * Determine the appropriate domain folder name for a given endpoint URL path and tags
   */
  getDomainFolderName(urlPath: string, tags: string[] = []): string {
    for (const folder of this.domainFolders) {
      if (folder.matchers(urlPath, tags)) {
        return folder.name;
      }
    }
    return '6. Other Operations';
  }

  /**
   * Sort Postman collection items by domain order
   */
  sortCollectionFolders(items: any[]): any[] {
    const orderMap: Record<string, number> = {};
    for (const folder of this.domainFolders) {
      orderMap[folder.name] = folder.order;
    }

    return items.sort((a, b) => {
      const orderA = orderMap[a.name] || 99;
      const orderB = orderMap[b.name] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
  }
}
