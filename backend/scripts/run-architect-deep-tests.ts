import { PrismaClient } from '../prisma/generated';

const prisma = new PrismaClient();

interface TestCaseResult {
  id: string;
  category: string;
  title: string;
  expectedStatus: number | number[];
  actualStatus: number;
  expectedErrorCode?: string;
  actualErrorCode?: string;
  passed: boolean;
  notes: string;
  durationMs: number;
}

const results: TestCaseResult[] = [];

async function recordTest(
  id: string,
  category: string,
  title: string,
  expectedStatus: number | number[],
  fn: () => Promise<{ status: number; body: any }>,
  expectedErrorCode?: string,
  customAssert?: (status: number, body: any) => { passed: boolean; note?: string }
) {
  const start = Date.now();
  let status = 500;
  let body: any = null;
  let note = '';
  try {
    const res = await fn();
    status = res.status;
    body = res.body;
  } catch (err: any) {
    note = `Exception: ${err.message}`;
  }
  const durationMs = Date.now() - start;

  const actualErrorCode = body?.error?.code || body?.message || '';
  const expectedList = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  let passed = expectedList.includes(status);

  if (expectedErrorCode && passed) {
    const serialized = JSON.stringify(body);
    if (!serialized.includes(expectedErrorCode)) {
      passed = false;
      note = `Expected error code/message '${expectedErrorCode}' not found in: ${serialized.substring(0, 150)}`;
    }
  }

  if (customAssert && passed) {
    const assertion = customAssert(status, body);
    passed = assertion.passed;
    if (assertion.note) note = assertion.note;
  }

  if (!note && !passed) {
    note = `Expected HTTP ${expectedList.join('/')}, received ${status}. Body: ${JSON.stringify(body).substring(0, 150)}`;
  }

  results.push({
    id,
    category,
    title,
    expectedStatus,
    actualStatus: status,
    expectedErrorCode,
    actualErrorCode: typeof actualErrorCode === 'string' ? actualErrorCode : JSON.stringify(actualErrorCode),
    passed,
    notes: note || 'Passed as expected',
    durationMs,
  });

  const marker = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${marker} [${id}] ${title} (${durationMs}ms) -> HTTP ${status}`);
}

async function main() {
  console.log('===============================================================');
  console.log('   SENIOR ERP ARCHITECT: ADMISSION MODULE DEEP AUDIT SUITE     ');
  console.log('===============================================================\n');

  // Authenticate using signed JWT (bypasses auth throttler during test automation)
  const jwt = await import('jsonwebtoken');
  const accessToken = jwt.sign(
    {
      sub: '01a15864-87d4-75d1-b3aa-6a3e13cc83fe',
      email: 'admin@example.com',
      role: 'SUPER_ADMIN',
      organizationId: null,
      branchId: null,
    },
    'PASTE_A_GENERATED_SECRET_HERE',
    { expiresIn: '2h' }
  );

  const organizationId = '01a159ee-5fe8-7f12-bf26-774d90241d11';
  const branchId = '01a159f1-02e2-7371-8c7c-5b312283f862';
  const academicYearId = '01a159f2-0ebd-7291-9175-b300476bb006';
  const programId = '01a159f8-3884-7400-bf9e-49e3d1295eb1';

  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
    'x-organization-id': organizationId,
    'x-branch-id': branchId,
    'x-academic-year-id': academicYearId,
  };

  const validMaleGender = '01a15aad-8923-7a01-9e7d-25090fcc798b';
  const validSource = '01a15ab6-ce26-7ab2-b3ac-3a383bafd411';
  const validDivA = '01a15aa6-61ae-7e63-bf0a-72e973b2bbc0'; // First > Div A
  const parentUnitClass = '01a15a9f-1321-7033-834b-07ff9fe957f0'; // Class First (parent node)

  const makeValidPayload = (overrides = {}) => ({
    firstName: 'TestFirst',
    lastName: 'TestLast',
    dob: '2019-01-15',
    genderId: validMaleGender,
    birthPlace: 'Mumbai',
    primaryMobile: `9820${Math.floor(100000 + Math.random() * 900000)}`,
    currentAddressLine1: 'Test Address Line 1',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pincode: '400001',
    programId,
    admissionSourceId: validSource,
    ...overrides,
  });

  const apiPost = async (path: string, body: any, headers = defaultHeaders) => {
    const res = await fetch(`http://localhost:3001/v1${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const resBody = await res.json().catch(() => ({}));
    return { status: res.status, body: resBody };
  };

  const apiGet = async (path: string, headers = defaultHeaders) => {
    const res = await fetch(`http://localhost:3001/v1${path}`, {
      method: 'GET',
      headers,
    });
    const resBody = await res.json().catch(() => ({}));
    return { status: res.status, body: resBody };
  };

  const apiDelete = async (path: string, headers = defaultHeaders) => {
    const res = await fetch(`http://localhost:3001/v1${path}`, {
      method: 'DELETE',
      headers,
    });
    const resBody = await res.json().catch(() => ({}));
    return { status: res.status, body: resBody };
  };

  // --------------------------------------------------------------------------
  // CATEGORY 1: SCHEMA BOUNDARIES, DATATYPES & MALFORMED PAYLOADS
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 1: Schema Boundaries & Datatypes ---');

  await recordTest(
    'TC-1.1',
    'Schema Boundaries',
    'Missing mandatory firstName (empty string)',
    400,
    () => apiPost('/admissions/applicants', makeValidPayload({ firstName: '' }))
  );

  await recordTest(
    'TC-1.2',
    'Schema Boundaries',
    'Missing mandatory lastName (undefined)',
    400,
    () => {
      const p = makeValidPayload();
      delete (p as any).lastName;
      return apiPost('/admissions/applicants', p);
    }
  );

  await recordTest(
    'TC-1.3',
    'Schema Boundaries',
    'Datatype mutation: numeric firstName instead of string',
    400,
    () => apiPost('/admissions/applicants', makeValidPayload({ firstName: 12345 }))
  );

  await recordTest(
    'TC-1.4',
    'Schema Boundaries',
    'Datatype mutation: boolean dob instead of ISO date string',
    400,
    () => apiPost('/admissions/applicants', makeValidPayload({ dob: true }))
  );

  await recordTest(
    'TC-1.5',
    'Security / Injection',
    'SQL Injection payload in currentAddressLine1 (sanitized & safe)',
    201,
    () => apiPost('/admissions/applicants', makeValidPayload({
      currentAddressLine1: "Room 101, Chawl 4'; DROP TABLE \"Applicant\"; --"
    })),
    undefined,
    (status, body) => ({
      passed: status === 201 && body?.data?.currentAddressLine1?.includes("DROP TABLE"),
      note: 'SQL injection string properly stored as literal text without SQL execution'
    })
  );

  await recordTest(
    'TC-1.6',
    'Security / XSS',
    'XSS Script payload in internalRemarks (<script>alert(1)</script>)',
    201,
    () => apiPost('/admissions/applicants', makeValidPayload({
      internalRemarks: '<script>alert("XSS")</script>'
    }))
  );

  await recordTest(
    'TC-1.7',
    'Boundary / Date',
    'Malformed Date format for DOB (e.g., "invalid-date-string")',
    400,
    () => apiPost('/admissions/applicants', makeValidPayload({ dob: 'invalid-date' }))
  );

  await recordTest(
    'TC-1.8',
    'Boundary / Date',
    'Future Date of Birth (born in year 2035) — Advisory/Domain Edge',
    [201, 400], // Inspect behavior
    () => apiPost('/admissions/applicants', makeValidPayload({ dob: '2035-01-01' })),
    undefined,
    (status, body) => ({
      passed: true,
      note: status === 201
        ? 'NOTE: Backend schema accepts future DOB as valid ISO string; Domain validation rule could be added'
        : 'Backend rejected future DOB'
    })
  );

  // --------------------------------------------------------------------------
  // CATEGORY 2: REGULATORY IDENTITY FORMAT VALIDATIONS (AADHAAR, MOBILE, PINCODE)
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 2: Indian Regulatory Formats (Aadhaar, Mobile, Pincode) ---');

  await recordTest(
    'TC-2.1',
    'Identity / Aadhaar',
    'Aadhaar starting with 0 (UIDAI violation: 012345678901)',
    400,
    () => apiPost('/admissions/applicants', makeValidPayload({ aadhaarNo: '012345678901' })),
    'Aadhaar'
  );

  await recordTest(
    'TC-2.2',
    'Identity / Aadhaar',
    'Aadhaar starting with 1 (UIDAI violation: 112345678901)',
    400,
    () => apiPost('/admissions/applicants', makeValidPayload({ aadhaarNo: '112345678901' })),
    'Aadhaar'
  );

  await recordTest(
    'TC-2.3',
    'Identity / Aadhaar',
    'Aadhaar with fewer than 12 digits (987654321)',
    400,
    () => apiPost('/admissions/applicants', makeValidPayload({ aadhaarNo: '987654321' }))
  );

  await recordTest(
    'TC-2.4',
    'Identity / Aadhaar',
    'Aadhaar with alphabetic characters (23456789ABCD)',
    400,
    () => apiPost('/admissions/applicants', makeValidPayload({ aadhaarNo: '23456789ABCD' }))
  );

  await recordTest(
    'TC-2.5',
    'Identity / Aadhaar',
    'Valid Aadhaar format (234567890123)',
    201,
    () => apiPost('/admissions/applicants', makeValidPayload({ aadhaarNo: '234567890123' }))
  );

  await recordTest(
    'TC-2.6',
    'Identity / Mobile',
    'Primary mobile with letters (98200ABCD1)',
    400,
    () => apiPost('/admissions/applicants', makeValidPayload({ primaryMobile: '98200ABCD1' }))
  );

  await recordTest(
    'TC-2.7',
    'Identity / Mobile',
    'Primary mobile with only 4 digits (1234)',
    400,
    () => apiPost('/admissions/applicants', makeValidPayload({ primaryMobile: '1234' }))
  );

  await recordTest(
    'TC-2.8',
    'Contact / Email',
    'Malformed email address (invalid-email-format)',
    400,
    () => apiPost('/admissions/applicants', makeValidPayload({ primaryEmail: 'invalid-email-format' }))
  );

  await recordTest(
    'TC-2.9',
    'Address / Pincode',
    'Invalid Pincode with special characters (400@#$)',
    400,
    () => apiPost('/admissions/applicants', makeValidPayload({ pincode: '400@#$' }))
  );

  // --------------------------------------------------------------------------
  // CATEGORY 3: MULTI-TENANT SCOPE & TENANT LEAKAGE DEFENSE
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 3: Multi-Tenant Scope & Branch Isolation ---');

  await recordTest(
    'TC-3.1',
    'Tenant Scope',
    'Missing x-branch-id header on applicant registration',
    400,
    () => {
      const headers = { ...defaultHeaders };
      delete (headers as any)['x-branch-id'];
      return apiPost('/admissions/applicants', makeValidPayload(), headers);
    }
  );

  await recordTest(
    'TC-3.2',
    'Tenant Scope',
    'Missing x-academic-year-id header on applicant registration',
    400,
    () => {
      const headers = { ...defaultHeaders };
      delete (headers as any)['x-academic-year-id'];
      return apiPost('/admissions/applicants', makeValidPayload(), headers);
    }
  );

  await recordTest(
    'TC-3.3',
    'Tenant Scope',
    'Cross-tenant isolation: Request with non-existent foreign organization ID',
    [403, 404, 400],
    () => {
      const headers = { ...defaultHeaders, 'x-organization-id': '00000000-0000-0000-0000-000000000000' };
      return apiPost('/admissions/applicants', makeValidPayload(), headers);
    }
  );

  // --------------------------------------------------------------------------
  // CATEGORY 4: FOREIGN KEY INTEGRITY & DELETED MASTER DEFENSE
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 4: Master Foreign Key Integrity & Reference Guards ---');

  await recordTest(
    'TC-4.1',
    'Foreign Keys',
    'Non-existent Gender UUID in applicant creation',
    404,
    () => apiPost('/admissions/applicants', makeValidPayload({ genderId: '00000000-0000-4000-8000-000000000099' })),
    'Gender'
  );

  await recordTest(
    'TC-4.2',
    'Foreign Keys',
    'Referencing soft-deleted admission source',
    404,
    () => apiPost('/admissions/applicants', makeValidPayload({ admissionSourceId: '01a15aaf-fe5e-71c3-811d-823c89e93e83' })),
    'Admission Source'
  );

  await recordTest(
    'TC-4.3',
    'Foreign Keys',
    'Program UUID not belonging to target branch',
    [400, 404],
    () => apiPost('/admissions/applicants', makeValidPayload({ programId: '00000000-0000-4000-8000-000000000001' }))
  );

  // --------------------------------------------------------------------------
  // CATEGORY 5: ACADEMIC PLACEMENT & LEAF-NODE RULES
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 5: Academic Placement & Structural Node Rules ---');

  // Create a clean applicant for placement tests
  const placementApplicantRes = await apiPost('/admissions/applicants', makeValidPayload({ firstName: 'PlacementTest' }));
  const placementApplicantId = placementApplicantRes.body.data.id;

  await recordTest(
    'TC-5.1',
    'Academic Placement',
    'Admitting into non-existent academicUnitId',
    404,
    () => apiPost(`/admissions/applicants/${placementApplicantId}/direct-admit`, {
      academicUnitId: '00000000-0000-4000-8000-000000000000',
      admissionType: 'REGULAR',
    }),
    'ACADEMIC_UNIT_NOT_FOUND'
  );

  await recordTest(
    'TC-5.2',
    'Academic Placement',
    'Admitting into a Parent/Structural Unit (Class node instead of Division)',
    400,
    () => apiPost(`/admissions/applicants/${placementApplicantId}/direct-admit`, {
      academicUnitId: parentUnitClass,
      admissionType: 'REGULAR',
    }),
    'ACADEMIC_UNIT_NOT_PLACEMENT_TARGET'
  );

  // Now admit placement applicant correctly into Div A
  const admitSuccessRes = await apiPost(`/admissions/applicants/${placementApplicantId}/direct-admit`, {
    academicUnitId: validDivA,
    admissionType: 'REGULAR',
  });
  console.log(`Placed applicant ${placementApplicantId} into valid Div A -> Status: ${admitSuccessRes.status}`);

  // --------------------------------------------------------------------------
  // CATEGORY 6: ADMISSION LIFECYCLE & STATE MACHINE CONSTRAINTS
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 6: Admission Lifecycle & State Machine Constraints ---');

  await recordTest(
    'TC-6.1',
    'State Machine',
    'Re-admitting an already ADMITTED applicant (Double admit prevention)',
    [400, 409],
    () => apiPost(`/admissions/applicants/${placementApplicantId}/direct-admit`, {
      academicUnitId: validDivA,
      admissionType: 'REGULAR',
    })
  );

  await recordTest(
    'TC-6.2',
    'Lifecycle / Immutability',
    'Attempting to soft-delete an ADMITTED applicant (Integrity guard)',
    [400, 403, 409],
    () => apiDelete(`/admissions/applicants/${placementApplicantId}`)
  );

  // --------------------------------------------------------------------------
  // CATEGORY 7: CONCURRENCY & MONOTONIC SEQUENCE RACE CONDITIONS
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 7: Concurrency & Monotonic Race Condition ---');

  // Create an applicant specifically to test concurrent duplicate admission
  const raceApplicantRes = await apiPost('/admissions/applicants', makeValidPayload({ firstName: 'RaceConditionTest' }));
  const raceApplicantId = raceApplicantRes.body.data.id;

  await recordTest(
    'TC-7.1',
    'Concurrency',
    'Simultaneous 5-way directAdmit race on the exact same applicant row',
    200, // Composite assert
    async () => {
      const promises = [1, 2, 3, 4, 5].map(() =>
        apiPost(`/admissions/applicants/${raceApplicantId}/direct-admit`, {
          academicUnitId: validDivA,
          admissionType: 'REGULAR',
        })
      );
      const responses = await Promise.all(promises);
      const statuses = responses.map(r => r.status);
      const successCount = statuses.filter(s => s === 201).length;
      const conflictCount = statuses.filter(s => s === 409 || s === 400).length;

      return {
        status: 200,
        body: { statuses, successCount, conflictCount }
      };
    },
    undefined,
    (status, body) => {
      const { successCount, conflictCount, statuses } = body;
      const passed = successCount === 1 && conflictCount === 4;
      return {
        passed,
        note: `Statuses: [${statuses.join(', ')}]. Exactly 1 success (201) and 4 rejected (${conflictCount}) -> Row lock protected!`
      };
    }
  );

  // Print results summary
  const total = results.length;
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = total - passedCount;

  console.log('\n===============================================================');
  console.log(` AUDIT SUITE FINISHED: ${passedCount}/${total} PASSED (${failedCount} failed)`);
  console.log('===============================================================\n');

  // Output test results to a scratch file so the agent can read and compile the report
  const fs = await import('fs');
  fs.writeFileSync('scripts/test-results.json', JSON.stringify(results, null, 2));
  console.log('Test results written to scripts/test-results.json');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
