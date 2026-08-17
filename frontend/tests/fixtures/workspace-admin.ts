import type {
  HealthCheckResultDto,
  LivenessDto,
  MenuDetailDto,
  MenuDto,
  MenuListItemDto,
  ModuleDetailDto,
  ModuleDto,
  ModuleListItemDto,
  NavigationTreeDto,
  WorkspaceConfigurationDto,
  WorkspaceSetupStatusDto,
} from "@/features/workspace-admin";

/** A module as `GET /admin/navigation/modules/:id` returns it (no `_count`). */
export function moduleDto(overrides: Partial<ModuleDto> = {}): ModuleDto {
  return {
    id: "module-1",
    code: "ADMISSIONS",
    name: "Admissions",
    description: "Applicant intake and enrolment.",
    icon: "users",
    displayOrder: 1,
    isSystem: false,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function moduleListItemDto(
  overrides: Partial<ModuleListItemDto> = {},
): ModuleListItemDto {
  const { _count, ...rest } = overrides;
  return {
    ...moduleDto(rest),
    _count: { menus: 1, ..._count },
  };
}

export function secondModuleListItemDto(
  overrides: Partial<ModuleListItemDto> = {},
): ModuleListItemDto {
  return moduleListItemDto({
    id: "module-2",
    code: "HOSTEL",
    name: "Hostel Management",
    icon: "home",
    displayOrder: 2,
    _count: { menus: 0 },
    ...overrides,
  });
}

export function menuDto(overrides: Partial<MenuDto> = {}): MenuDto {
  return {
    id: "menu-1",
    code: "ADMISSIONS_APPLICANTS",
    moduleId: "module-1",
    parentId: null,
    route: "/admissions/applicants",
    componentIdentifier: "ApplicantsListContainer",
    permissions: ["admissions.view"],
    permissionMode: "ALL",
    displayName: "Applicants",
    icon: "users",
    tooltip: "View applicant records",
    description: "Manage student applications and registrations",
    displayOrder: 1,
    badge: null,
    searchKeywords: ["students", "applicants"],
    helpUrl: null,
    documentationUrl: null,
    status: "ACTIVE",
    isSystem: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function menuListItemDto(
  overrides: Partial<MenuListItemDto> = {},
): MenuListItemDto {
  const { module, parent, ...rest } = overrides;
  return {
    ...menuDto(rest),
    module: { id: "module-1", code: "ADMISSIONS", name: "Admissions", ...module },
    parent: parent ?? null,
  };
}

export function childMenuListItemDto(
  overrides: Partial<MenuListItemDto> = {},
): MenuListItemDto {
  return menuListItemDto({
    id: "menu-2",
    code: "ADMISSIONS_APPLICANTS_NEW",
    parentId: "menu-1",
    route: "/admissions/applicants/new",
    displayName: "New Applicant",
    displayOrder: 1,
    parent: { id: "menu-1", code: "ADMISSIONS_APPLICANTS", displayName: "Applicants" },
    ...overrides,
  });
}

export function menuDetailDto(
  overrides: Partial<MenuDetailDto> = {},
): MenuDetailDto {
  return {
    ...menuDto(overrides),
    module: {
      id: "module-1",
      code: "ADMISSIONS",
      name: "Admissions",
      description: null,
      icon: "users",
      displayOrder: 1,
      isSystem: false,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    parent: null,
    children: [],
    ...overrides,
  };
}

export function moduleDetailDto(
  overrides: Partial<ModuleDetailDto> = {},
): ModuleDetailDto {
  const { menus, ...rest } = overrides;
  return {
    ...moduleDto(rest),
    menus: menus ?? [menuDto()],
  };
}

export function workspaceConfigurationDto(
  overrides: Partial<WorkspaceConfigurationDto> = {},
): WorkspaceConfigurationDto {
  return {
    id: "config-1",
    scopeType: "USER",
    scopeId: "user-1",
    navigationPreferences: { sidebarCollapsed: true },
    clientPreferences: { theme: "dark" },
    isActive: true,
    createdById: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function setupStatusDto(
  overrides: Partial<WorkspaceSetupStatusDto> = {},
): WorkspaceSetupStatusDto {
  return {
    setupRequired: false,
    setupStage: "COMPLETED",
    missingResources: [],
    completedResources: ["ORGANIZATION", "BRANCH", "ACADEMIC_YEAR"],
    allowedActions: [],
    initializedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function navigationTreeDto(
  overrides: Partial<NavigationTreeDto> = {},
): NavigationTreeDto {
  return {
    tree: [],
    totalVisibleMenus: 4,
    menuTreeDepth: 2,
    ...overrides,
  };
}

export function livenessDto(overrides: Partial<LivenessDto> = {}): LivenessDto {
  return { status: "ok", uptimeSeconds: 3661, ...overrides };
}

export function healthCheckResultDto(
  overrides: Partial<HealthCheckResultDto> = {},
): HealthCheckResultDto {
  return {
    status: "ok",
    info: { database: { status: "up" } },
    error: {},
    details: { database: { status: "up" } },
    ...overrides,
  };
}
