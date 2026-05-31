'use client';

import { useContextStore } from '@/stores/context.store';

/**
 * Returns the current ERP workspace context.
 * Convenient shorthand for the full context store.
 *
 * @example
 * const { branchId, academicYearId } = useAppContext();
 */
export function useAppContext() {
  return useContextStore((s) => ({
    organizationId: s.organizationId,
    organizationName: s.organizationName,
    organizationCode: s.organizationCode,
    branchId: s.branchId,
    branchName: s.branchName,
    branchCode: s.branchCode,
    academicYearId: s.academicYearId,
    academicYearName: s.academicYearName,
    programId: s.programId,
    programName: s.programName,
    financialYearId: s.financialYearId,
    financialYearName: s.financialYearName,
  }));
}
