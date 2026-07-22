import { AuditEventMapper } from '@/infrastructure/audit/audit-event.mapper';
import { StudentCreatedEvent } from '@/common/events/examples/student-created.event';
import { BranchCreatedEvent } from '@/common/events/examples/branch-created.event';
import { UserLoggedInEvent } from '@/common/events/examples/user-logged-in.event';
import { RequestContext } from '@/common/logger/request-context.middleware';

describe('AuditEventMapper', () => {
  let mapper: AuditEventMapper;

  beforeEach(() => {
    mapper = new AuditEventMapper();
  });

  it('should map StudentCreatedEvent into AuditLog payload with inferred action and module', () => {
    const event = new StudentCreatedEvent({
      studentId: 'stud-55',
      fullName: 'Ananya Rao',
      admissionNo: 'ADM-2026-55',
    });

    const auditData = mapper.mapToAuditLog(event);

    expect(auditData.eventName).toBe('student.created');
    expect(auditData.action).toBe('CREATE');
    expect(auditData.module).toBe('ADMISSIONS');
    expect(auditData.aggregateType).toBe('Student');
    expect(auditData.aggregateId).toBe('stud-55');
    expect(auditData.metadata).toBeDefined();
    expect(auditData.metadata?.payload?.fullName).toBe('Ananya Rao');
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
      fullName: 'Kiran Verma',
      admissionNo: 'ADM-100',
    });

    const mockContext: RequestContext = {
      requestId: 'req-uuid-777',
      userId: 'admin-user-id',
      role: 'ORG_ADMIN',
      organizationId: 'org-uuid-1',
      branchId: 'branch-uuid-2',
      academicYearId: 'ay-uuid-3',
    };

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
});
