'use client';

// ============================================================
// Context Store — ERP Workspace Context
// Stores the currently selected Org / Branch / Year / Program.
// Persisted in localStorage — survives tab close.
// Validated against API on boot.
// ============================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ContextState {
  // Organization
  organizationId: string | null;
  organizationName: string | null;
  organizationCode: string | null;

  // Branch
  branchId: string | null;
  branchName: string | null;
  branchCode: string | null;

  // Academic Year
  academicYearId: string | null;
  academicYearName: string | null;

  // Program
  programId: string | null;
  programName: string | null;

  // Financial Year (future)
  financialYearId: string | null;
  financialYearName: string | null;

  // Actions
  setOrganization: (org: {
    id: string;
    name: string;
    code?: string;
  }) => void;
  setBranch: (branch: {
    id: string;
    name: string;
    code?: string;
  }) => void;
  setAcademicYear: (year: { id: string; name: string }) => void;
  setProgram: (program: { id: string; name: string } | null) => void;
  setFinancialYear: (year: { id: string; name: string } | null) => void;
  /**
   * Resets all context below Organization (Branch → Year → Program).
   */
  resetBelowOrg: () => void;
  /**
   * Resets all context below Branch (Year → Program).
   */
  resetBelowBranch: () => void;
  /**
   * Resets all context below Academic Year (Program).
   */
  resetBelowYear: () => void;
  /**
   * Full reset — clears everything.
   */
  resetAll: () => void;
}

const EMPTY_CONTEXT = {
  organizationId: null,
  organizationName: null,
  organizationCode: null,
  branchId: null,
  branchName: null,
  branchCode: null,
  academicYearId: null,
  academicYearName: null,
  programId: null,
  programName: null,
  financialYearId: null,
  financialYearName: null,
};

export const useContextStore = create<ContextState>()(
  persist(
    (set) => ({
      ...EMPTY_CONTEXT,

      setOrganization: ({ id, name, code }) =>
        set({
          organizationId: id,
          organizationName: name,
          organizationCode: code ?? null,
          // Cascade: changing org clears all downstream
          branchId: null,
          branchName: null,
          branchCode: null,
          academicYearId: null,
          academicYearName: null,
          programId: null,
          programName: null,
        }),

      setBranch: ({ id, name, code }) =>
        set({
          branchId: id,
          branchName: name,
          branchCode: code ?? null,
          // Cascade: changing branch clears year and program
          academicYearId: null,
          academicYearName: null,
          programId: null,
          programName: null,
        }),

      setAcademicYear: ({ id, name }) =>
        set({
          academicYearId: id,
          academicYearName: name,
          // Cascade: changing year clears program
          programId: null,
          programName: null,
        }),

      setProgram: (program) =>
        set({
          programId: program?.id ?? null,
          programName: program?.name ?? null,
        }),

      setFinancialYear: (year) =>
        set({
          financialYearId: year?.id ?? null,
          financialYearName: year?.name ?? null,
        }),

      resetBelowOrg: () =>
        set({
          branchId: null,
          branchName: null,
          branchCode: null,
          academicYearId: null,
          academicYearName: null,
          programId: null,
          programName: null,
          financialYearId: null,
          financialYearName: null,
        }),

      resetBelowBranch: () =>
        set({
          academicYearId: null,
          academicYearName: null,
          programId: null,
          programName: null,
        }),

      resetBelowYear: () =>
        set({
          programId: null,
          programName: null,
        }),

      resetAll: () => set(EMPTY_CONTEXT),
    }),
    {
      name: 'eduos-context',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return localStorage;
      }),
    },
  ),
);

// ── Selectors ─────────────────────────────────────────────────

export const selectOrganizationId = (s: ContextState) => s.organizationId;
export const selectBranchId = (s: ContextState) => s.branchId;
export const selectAcademicYearId = (s: ContextState) => s.academicYearId;
export const selectProgramId = (s: ContextState) => s.programId;

/**
 * Returns the ERP context headers for injection into every API request.
 * The backend uses these to scope data to the correct tenant context.
 * Matches the Postman pre-request script: x-tenant-id, x-organization-id,
 * x-branch-id, x-academic-year-id.
 */
export const selectContextHeaders = (s: ContextState) => ({
  'x-organization-id':  s.organizationId,
  'x-branch-id':        s.branchId,
  'x-academic-year-id': s.academicYearId,
  // x-tenant-id is derived from organizationCode when available
  ...(s.organizationCode ? { 'x-tenant-id': s.organizationCode } : {}),
});
