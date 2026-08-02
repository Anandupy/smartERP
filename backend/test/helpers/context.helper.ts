import { PrismaClient } from '../../prisma/generated';

/**
 * Index signature included so the object is assignable to supertest's
 * `IncomingHttpHeaders` parameter.
 */
export interface ContextHeaders {
  [header: string]: string | undefined;
  'x-organization-id': string;
  'x-branch-id'?: string;
  'x-academic-year-id'?: string;
}

/**
 * Pins a request to a specific tenant scope.
 *
 * The Execution Context Platform answers 409 `CONTEXT_SELECTION_REQUIRED` when
 * a user can see more than one organization and names none. Every e2e spec runs
 * against the same database with `--runInBand`, and each one creates
 * organizations of its own, so by the second spec the scope is always
 * ambiguous. Requests must therefore say which tenant they mean — exactly as a
 * real client does.
 *
 * Pass the ids the spec created; omit `academicYearId` for routes that do not
 * carry `@RequireAcademicYear()`.
 */
export const contextHeaders = (
  organizationId: string,
  branchId: string,
  academicYearId?: string,
): ContextHeaders => {
  const headers: ContextHeaders = {
    'x-organization-id': organizationId,
    'x-branch-id': branchId,
  };

  if (academicYearId) {
    headers['x-academic-year-id'] = academicYearId;
  }

  return headers;
};

/**
 * Creates an organization, branch and academic year dedicated to one spec, and
 * returns headers pinning requests to them.
 *
 * Use when a spec needs a resolvable scope but does not care about the specific
 * records.
 */
export const createIsolatedContext = async (
  prisma: PrismaClient,
  label: string,
): Promise<ContextHeaders & { organizationId: string; branchId: string }> => {
  const stamp = `${label}-${Date.now()}`;

  const organization = await prisma.organization.create({
    data: {
      name: `${label} Organization`,
      code: stamp,
      status: 'ACTIVE',
      contactEmail: `${stamp}@test.local`,
      contactPhone: '9000000000',
      masterExpiryDate: new Date('2099-12-31'),
    },
  });

  const branch = await prisma.branch.create({
    data: {
      organizationId: organization.id,
      name: `${label} Branch`,
      code: `${stamp}-BR`,
      institutionType: 'SCHOOL',
      contactEmail: `${stamp}-br@test.local`,
      contactPhone: '9000000001',
      addressLine1: '1 Test Road',
      city: 'Testville',
      state: 'TS',
      country: 'IN',
      pincode: '000000',
      isActive: true,
    },
  });

  const academicYear = await prisma.academicYear.create({
    data: {
      branchId: branch.id,
      name: `${label} AY`,
      startDate: new Date('2025-04-01'),
      endDate: new Date('2026-03-31'),
      isActive: true,
      isSelected: true,
    },
  });

  return {
    ...contextHeaders(organization.id, branch.id, academicYear.id),
    organizationId: organization.id,
    branchId: branch.id,
  };
};

/**
 * Pins a request to an organization only.
 *
 * For specs whose organization has no branch yet — the ones exercising branch
 * creation. Resolution leaves the branch scope null, which routes without
 * `@RequireBranch()` accept.
 */
export const organizationHeaders = (
  organizationId: string,
): ContextHeaders => ({
  'x-organization-id': organizationId,
});
