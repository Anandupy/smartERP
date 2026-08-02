export interface ExecutionContextPayload {
  organizationId: string | null;
  branchId: string | null;
  academicYearId: string | null;
  programId: null;
  departmentId: null;
  campusId: null;

  // Optional hydrated entities when available
  branch?: {
    id: string;
    organizationId: string;
    name: string;
    code: string;
    institutionType: string;
    isActive: boolean;
    isDeleted: boolean;
  } | null;
  academicYear?: {
    id: string;
    branchId: string;
    name: string;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    isSelected: boolean;
    isLocked: boolean;
  } | null;
}

export interface AvailableOrganizationItem {
  id: string;
  name: string;
  code: string;
  status: string;
}

export interface AvailableBranchItem {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  institutionType: string;
  isActive: boolean;
}

export interface AvailableAcademicYearItem {
  id: string;
  branchId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  isSelected: boolean;
  isLocked: boolean;
}

export interface ContextDiscoveryResult {
  availableOrganizations: AvailableOrganizationItem[];
  availableBranches: AvailableBranchItem[];
  availableAcademicYears: AvailableAcademicYearItem[];
}

export interface ResolvedContextResult {
  context: ExecutionContextPayload;
  source: 'HEADER' | 'AUTO' | 'SINGLE_CONTEXT';
  discovery: ContextDiscoveryResult;
}
