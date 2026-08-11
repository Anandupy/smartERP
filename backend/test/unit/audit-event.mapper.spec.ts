import { AuditEventMapper } from '@/infrastructure/audit/audit-event.mapper';
import { StudentCreatedEvent } from '@/common/events/student.events';
import { BranchCreatedEvent } from '@/common/events/examples/branch-created.event';
import { UserLoggedInEvent } from '@/common/events/examples/user-logged-in.event';
import { RequestContext } from '@/common/logger/request-context.middleware';
import { buildRequestContext } from '../factories/request-context.factory';

describe('AuditEventMapper', () => {
  let mapper: AuditEventMapper;

  beforeEach(() => {
    mapper = new AuditEventMapper();
  });

  it('should map StudentCreatedEvent into AuditLog payload with inferred action and module', () => {
    const event = new StudentCreatedEvent({
      studentId: 'stud-55',
      organizationId: 'org-1',
      branchId: 'branch-1',
      personId: 'person-1',
      studentCode: 'STU0000000001',
      createdVia: 'ADMISSION',
      sourceApplicantId: 'app-1',
    });

    const auditData = mapper.mapToAuditLog(event);

    expect(auditData.eventName).toBe('student.created');
    expect(auditData.action).toBe('CREATE');
    expect(auditData.module).toBe('ADMISSIONS');
    expect(auditData.aggregateType).toBe('Student');
    expect(auditData.aggregateId).toBe('stud-55');
    expect(auditData.metadata).toBeDefined();
    expect(auditData.metadata?.payload?.studentCode).toBe('STU0000000001');
  });

  it('should map BranchCreatedEvent and infer ORGANIZATION module', () => {
    const event = new BranchCreatedEvent({
      branchId: 'br-99',
      name: 'South Campus',
      code: 'SC-01',
    });

    const auditData = mapper.mapToAuditLog(event);

    expect(auditData.eventName).toBe('branch.created');
    expect(auditData.action).toBe('CREATE');
    expect(auditData.module).toBe('ORGANIZATION');
    expect(auditData.aggregateId).toBe('br-99');
  });

  it('should map UserLoggedInEvent and infer AUTH module and LOGIN action', () => {
    const event = new UserLoggedInEvent({
      userId: 'user-77',
      username: 'admin_test',
      loginAt: new Date(),
    });

    const auditData = mapper.mapToAuditLog(event);

    expect(auditData.eventName).toBe('user.logged_in');
    expect(auditData.action).toBe('LOGIN');
    expect(auditData.module).toBe('AUTH');
    expect(auditData.aggregateId).toBe('user-77');
  });

  it('should enrich audit payload with RequestContext parameters when provided', () => {
    const event = new StudentCreatedEvent({
      studentId: 'stud-100',
      organizationId: 'org-1',
      branchId: 'branch-1',
      personId: 'person-1',
      studentCode: 'STU0000000001',
      createdVia: 'ADMISSION',
      sourceApplicantId: 'app-1',
    });

    const mockContext: RequestContext = buildRequestContext({
      requestId: 'req-uuid-777',
      userId: 'admin-user-id',
      role: 'ORG_ADMIN',
      organizationId: 'org-uuid-1',
      branchId: 'branch-uuid-2',
      academicYearId: 'ay-uuid-3',
    });

    const auditData = mapper.mapToAuditLog(event, mockContext);

    expect(auditData.requestId).toBe('req-uuid-777');
    expect(auditData.userId).toBe('admin-user-id');
    expect(auditData.role).toBe('ORG_ADMIN');
    expect(auditData.organizationId).toBe('org-uuid-1');
    expect(auditData.branchId).toBe('branch-uuid-2');
    expect(auditData.academicYearId).toBe('ay-uuid-3');
  });

  it('should extract field-level diffs from event metadata if present', () => {
    const fieldChanges = [
      { field: 'name', oldValue: 'Old Branch', newValue: 'New Branch Name' },
      { field: 'code', oldValue: 'OB-01', newValue: 'NB-01' },
    ];

    const event = new BranchCreatedEvent(
      { branchId: 'br-1', name: 'New Branch Name', code: 'NB-01' },
      { action: 'UPDATE', changes: fieldChanges },
    );

    const auditData = mapper.mapToAuditLog(event);

    expect(auditData.action).toBe('UPDATE');
    expect(auditData.changes).toEqual(fieldChanges);
  });

  it('records every field a security investigation needs', () => {
    const event = new StudentCreatedEvent({
      studentId: 'stud-1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      personId: 'person-1',
      studentCode: 'STU0000000001',
      createdVia: 'ADMISSION',
      sourceApplicantId: 'app-1',
    });

    const auditData = mapper.mapToAuditLog(
      event,
      buildRequestContext({
        requestId: 'req-1',
        userId: 'user-1',
        userEmail: 'admin@example.com',
        role: 'ORG_ADMIN',
        organizationId: 'org-1',
        branchId: 'branch-1',
        academicYearId: 'ay-1',
        ipAddress: '203.0.113.7',
        userAgent: 'Mozilla/5.0',
        httpMethod: 'POST',
        route: '/v1/admissions/applicants',
      }),
    );

    // The mapper previously read ipAddress, userAgent, userEmail, httpMethod
    // and route from fields the context never had, so those columns were
    // always null and an audit row could not be placed on a network or device.
    expect(auditData.userId).toBe('user-1');
    expect(auditData.userEmail).toBe('admin@example.com');
    expect(auditData.role).toBe('ORG_ADMIN');
    expect(auditData.organizationId).toBe('org-1');
    expect(auditData.branchId).toBe('branch-1');
    expect(auditData.academicYearId).toBe('ay-1');
    expect(auditData.requestId).toBe('req-1');
    expect(auditData.correlationId).toBe('req-1');
    expect(auditData.ipAddress).toBe('203.0.113.7');
    expect(auditData.userAgent).toBe('Mozilla/5.0');
    expect(auditData.httpMethod).toBe('POST');
    expect(auditData.route).toBe('/v1/admissions/applicants');
    expect(auditData.action).toBe('CREATE');
    expect(auditData.aggregateId).toBe('stud-1');
    expect(auditData.status).toBe('SUCCESS');
  });
});
