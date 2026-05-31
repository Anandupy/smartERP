// ============================================================
// Domain Types — Mirrors backend Prisma models and enums
// These are the source-of-truth TypeScript interfaces.
// DO NOT modify without verifying against backend contracts.
// ============================================================

// ── Enums (mirrored from Prisma) ─────────────────────────────

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ORG_ADMIN'
  | 'BRANCH_ADMIN'
  | 'STAFF'
  | 'STUDENT'
  | 'PARENT';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

export type OrganizationStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type InstitutionType =
  | 'SCHOOL'
  | 'JUNIOR_COLLEGE'
  | 'DEGREE_COLLEGE'
  | 'UNIVERSITY'
  | 'ENGINEERING'
  | 'MEDICAL'
  | 'OTHER';

export type AffiliationType = 'BOARD' | 'UNIVERSITY' | 'OTHER';

export type StructureMode = 'DEFAULT' | 'CUSTOM';

export type ProgramLevel = 'SCHOOL' | 'COLLEGE' | 'DEGREE';

export type AcademicUnitType =
  | 'SECTION'
  | 'CLASS'
  | 'DIVISION'
  | 'STREAM'
  | 'DEPARTMENT'
  | 'YEAR'
  | 'SEMESTER'
  | 'BATCH'
  | 'CUSTOM';

export type Environment = 'DEV' | 'STAGING' | 'PROD';

// ── Auth ─────────────────────────────────────────────────────

export interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  role: UserRole;
  organizationId: string | null;
  branchId: string | null;
  status: UserStatus;
  isTwoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface Session {
  id: string;
  device: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

// JWT Payload shape (decoded from accessToken)
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  organizationId: string | null;
  branchId: string | null;
  iat: number;
  exp: number;
}

// ── Organization ─────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
  contactEmail: string;
  contactPhone: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  masterExpiryDate: string;
  status: OrganizationStatus;
  timezone: string | null;
  currency: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Branch ───────────────────────────────────────────────────

export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  registrationNumber: string | null;
  institutionType: InstitutionType;
  affiliationType: AffiliationType | null;
  affiliationName: string | null;
  logoUrl: string | null;
  contactEmail: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  country: string;
  pincode: string;
  structureMode: StructureMode;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Academic Year ─────────────────────────────────────────────

export interface AcademicYear {
  id: string;
  branchId: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isSelected: boolean;
  isLocked: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// Derived state for lifecycle UI
export type AcademicYearState =
  | 'PLANNED'
  | 'ACTIVE'
  | 'CURRENT'
  | 'LOCKED'
  | 'ARCHIVE';

// ── Program ───────────────────────────────────────────────────

export interface Program {
  id: string;
  branchId: string;
  name: string;
  level: ProgramLevel | null;
  medium: string | null;
  stream: string | null;
  parentId: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  children?: Program[];
}

// ── Academic Unit ─────────────────────────────────────────────

export interface AcademicUnit {
  id: string;
  branchId: string;
  programId: string;
  academicYearId: string;
  parentId: string | null;
  name: string;
  code: string | null;
  unitType: AcademicUnitType;
  level: number;
  displayOrder: number | null;
  isActive: boolean;
  isDeleted: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  children?: AcademicUnit[];
}

// ── System Settings ───────────────────────────────────────────

export interface SystemSettings {
  id: string;
  productName: string;
  productCode: string;
  version: string;
  environment: Environment;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  defaultTimezone: string;
  defaultCurrency: string;
  defaultLanguage: string;
  supportEmail: string;
  supportPhone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
