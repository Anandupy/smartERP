// ============================================================
// Enum Constants — Mirror backend Prisma enum values
// Use these for dropdown options, display labels, etc.
// ============================================================

import type {
  UserRole,
  InstitutionType,
  AffiliationType,
  StructureMode,
  ProgramLevel,
  AcademicUnitType,
} from '@/types/domain.types';

// ── Roles ─────────────────────────────────────────────────────

export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ORG_ADMIN', label: 'Organization Admin' },
  { value: 'BRANCH_ADMIN', label: 'Branch Admin' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'STUDENT', label: 'Student' },
  { value: 'PARENT', label: 'Parent' },
];

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ORG_ADMIN: 'Organization Admin',
  BRANCH_ADMIN: 'Branch Admin',
  STAFF: 'Staff',
  STUDENT: 'Student',
  PARENT: 'Parent',
};

// ── Institution Types ─────────────────────────────────────────

export const INSTITUTION_TYPES: { value: InstitutionType; label: string }[] = [
  { value: 'SCHOOL', label: 'School' },
  { value: 'JUNIOR_COLLEGE', label: 'Junior College' },
  { value: 'DEGREE_COLLEGE', label: 'Degree College' },
  { value: 'UNIVERSITY', label: 'University' },
  { value: 'ENGINEERING', label: 'Engineering' },
  { value: 'MEDICAL', label: 'Medical' },
  { value: 'OTHER', label: 'Other' },
];

export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
  SCHOOL: 'School',
  JUNIOR_COLLEGE: 'Junior College',
  DEGREE_COLLEGE: 'Degree College',
  UNIVERSITY: 'University',
  ENGINEERING: 'Engineering',
  MEDICAL: 'Medical',
  OTHER: 'Other',
};

// ── Affiliation Types ─────────────────────────────────────────

export const AFFILIATION_TYPES: { value: AffiliationType; label: string }[] = [
  { value: 'BOARD', label: 'Board' },
  { value: 'UNIVERSITY', label: 'University' },
  { value: 'OTHER', label: 'Other' },
];

// ── Structure Modes ───────────────────────────────────────────

export const STRUCTURE_MODES: { value: StructureMode; label: string; description: string }[] = [
  {
    value: 'DEFAULT',
    label: 'Default',
    description: 'Standard academic unit structure (Class → Division → Section)',
  },
  {
    value: 'CUSTOM',
    label: 'Custom',
    description: 'Define your own hierarchy using custom academic unit types',
  },
];

// ── Program Levels ────────────────────────────────────────────

export const PROGRAM_LEVELS: { value: ProgramLevel; label: string }[] = [
  { value: 'SCHOOL', label: 'School' },
  { value: 'COLLEGE', label: 'College' },
  { value: 'DEGREE', label: 'Degree' },
];

// ── Academic Unit Types ───────────────────────────────────────

export const ACADEMIC_UNIT_TYPES: { value: AcademicUnitType; label: string }[] = [
  { value: 'CLASS', label: 'Class' },
  { value: 'SECTION', label: 'Section' },
  { value: 'DIVISION', label: 'Division' },
  { value: 'STREAM', label: 'Stream' },
  { value: 'DEPARTMENT', label: 'Department' },
  { value: 'YEAR', label: 'Year' },
  { value: 'SEMESTER', label: 'Semester' },
  { value: 'BATCH', label: 'Batch' },
  { value: 'CUSTOM', label: 'Custom' },
];

export const ACADEMIC_UNIT_TYPE_LABELS: Record<AcademicUnitType, string> = {
  SECTION: 'Section',
  CLASS: 'Class',
  DIVISION: 'Division',
  STREAM: 'Stream',
  DEPARTMENT: 'Department',
  YEAR: 'Year',
  SEMESTER: 'Semester',
  BATCH: 'Batch',
  CUSTOM: 'Custom',
};
