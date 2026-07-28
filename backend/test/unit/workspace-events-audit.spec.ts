import { AuditEventMapper } from '@/infrastructure/audit/audit-event.mapper';
import {
  ModuleCreatedEvent,
  ModuleUpdatedEvent,
  MenuCreatedEvent,
  MenuUpdatedEvent,
  MenuDeletedEvent,
  WorkspaceConfigurationUpdatedEvent,
} from '@/common/events/workspace.events';

describe('Workspace Events & Audit Mapping', () => {
  let mapper: AuditEventMapper;

  beforeEach(() => {
    mapper = new AuditEventMapper();
  });

  it('should map ModuleCreatedEvent to audit log input with WORKSPACE module', () => {
    const event = new ModuleCreatedEvent({
      moduleId: 'mod-101',
      code: 'HOSTEL',
      name: 'Hostel Management',
      performedBy: 'user-admin-1',
    });

    const auditInput = mapper.mapToAuditLog(event);

    expect(auditInput.eventName).toBe('workspace.module_created');
    expect(auditInput.module).toBe('WORKSPACE');
    expect(auditInput.action).toBe('CREATE');
    expect(auditInput.aggregateId).toBe('mod-101');
    expect(auditInput.aggregateType).toBe('Module');
    expect(auditInput.userId).toBe('user-admin-1');
  });

  it('should map ModuleUpdatedEvent to audit log input', () => {
    const event = new ModuleUpdatedEvent({
      moduleId: 'mod-101',
      code: 'HOSTEL',
      previousState: { name: 'Hostel' },
      newState: { name: 'Hostel Management' },
      performedBy: 'user-admin-1',
    });

    const auditInput = mapper.mapToAuditLog(event);

    expect(auditInput.eventName).toBe('workspace.module_updated');
    expect(auditInput.module).toBe('WORKSPACE');
    expect(auditInput.action).toBe('UPDATE');
    expect(auditInput.aggregateId).toBe('mod-101');
  });

  it('should map MenuCreatedEvent to audit log input', () => {
    const event = new MenuCreatedEvent({
      menuId: 'menu-201',
      code: 'HOSTEL_ROOMS',
      displayName: 'Rooms',
      route: '/hostel/rooms',
      performedBy: 'user-admin-1',
    });

    const auditInput = mapper.mapToAuditLog(event);

    expect(auditInput.eventName).toBe('workspace.menu_created');
    expect(auditInput.module).toBe('WORKSPACE');
    expect(auditInput.action).toBe('CREATE');
    expect(auditInput.aggregateId).toBe('menu-201');
    expect(auditInput.aggregateType).toBe('Menu');
  });

  it('should map MenuDeletedEvent to audit log input', () => {
    const event = new MenuDeletedEvent({
      menuId: 'menu-201',
      code: 'HOSTEL_ROOMS',
      performedBy: 'user-admin-1',
    });

    const auditInput = mapper.mapToAuditLog(event);

    expect(auditInput.eventName).toBe('workspace.menu_deleted');
    expect(auditInput.module).toBe('WORKSPACE');
    expect(auditInput.action).toBe('DELETE');
    expect(auditInput.aggregateId).toBe('menu-201');
  });

  it('should map WorkspaceConfigurationUpdatedEvent to audit log input', () => {
    const event = new WorkspaceConfigurationUpdatedEvent({
      configId: 'cfg-301',
      scopeType: 'ROLE',
      scopeId: 'STAFF',
      updatedBy: 'user-admin-1',
    });

    const auditInput = mapper.mapToAuditLog(event);

    expect(auditInput.eventName).toBe('workspace.config_updated');
    expect(auditInput.module).toBe('WORKSPACE');
    expect(auditInput.action).toBe('UPDATE');
    expect(auditInput.aggregateId).toBe('cfg-301');
    expect(auditInput.aggregateType).toBe('WorkspaceConfiguration');
  });
});
