/**
 * CampusFlow ERP — Application Permission Catalog
 *
 * Permissions represent immutable application capability contracts.
 * The catalog below defines all system permissions grouped by functional domains.
 */
export const PERMISSIONS = {
  Student: {
    View: 'student.view',
    Create: 'student.create',
    Update: 'student.update',
    Delete: 'student.delete',
    Export: 'student.export',
    Print: 'student.print',
  },
  Admissions: {
    View: 'admissions.view',
    Create: 'admissions.create',
    Update: 'admissions.update',
    Delete: 'admissions.delete',
    Approve: 'admissions.approve',
    Reject: 'admissions.reject',
    Export: 'admissions.export',
  },
  Fees: {
    View: 'fees.view',
    Collect: 'fees.collect',
    Refund: 'fees.refund',
    Discount: 'fees.discount',
    Report: 'fees.report',
  },
  Attendance: {
    View: 'attendance.view',
    Mark: 'attendance.mark',
    Edit: 'attendance.edit',
    Report: 'attendance.report',
  },
  HR: {
    View: 'hr.view',
    Manage: 'hr.manage',
    Payroll: 'hr.payroll',
  },
  Library: {
    View: 'library.view',
    Issue: 'library.issue',
    Return: 'library.return',
    Manage: 'library.manage',
  },
  Inventory: {
    View: 'inventory.view',
    Add: 'inventory.add',
    Issue: 'inventory.issue',
    Manage: 'inventory.manage',
  },
  Settings: {
    View: 'settings.view',
    Manage: 'settings.manage',
  },
  Reports: {
    View: 'reports.view',
    Export: 'reports.export',
  },
  System: {
    View: 'system.view',
    Manage: 'system.manage',
    Maintenance: 'system.maintenance',
  },
  Audit: {
    View: 'audit.view',
    Export: 'audit.export',
  },
  Communication: {
    View: 'communication.view',
    Send: 'communication.send',
    TemplateManage: 'communication.template.manage',
  },
} as const;

export type PermissionName = string;
