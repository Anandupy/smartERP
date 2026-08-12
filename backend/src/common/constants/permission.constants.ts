/**
 * CampusFlow ERP — Application Permission Catalog
 *
 * Permissions represent immutable application capability contracts.
 * The catalog below defines all system permissions grouped by functional domains.
 */
export const PERMISSIONS = {
  /**
   * Identity index.
   *
   * `View` returns linkage and a masked identifier and never decrypts anything.
   * Revealing a full government identifier is deliberately **not** a permission
   * here yet: the reveal ships together with the access log that records who
   * read what and why, and granting the capability before that log exists would
   * create reads nobody can account for.
   */
  Person: {
    View: 'person.view',
    Search: 'person.search',
    Correct: 'person.correct',
    AttachGovernmentId: 'person.attach_government_id',
  },
  Student: {
    View: 'student.view',
    /// Search and resolve codes. Separate from View so a receptionist can find
    /// a student without being able to read the full official record.
    Search: 'student.search',
    /// Look past the caller's branch. Out-of-branch matches come back as a
    /// reduced summary — enough to answer "is this one of ours, and where?".
    ViewOrganization: 'student.view.organization',
    Create: 'student.create',
    Update: 'student.update',
    Delete: 'student.delete',
    Export: 'student.export',
    Print: 'student.print',
  },
  /**
   * Academic placement.
   *
   * Split by *operation*, not by CRUD verb, because the operations differ in
   * consequence: assigning a roll number reshuffles a printed list and belongs
   * to office staff, while correcting a placement rewrites where a child is
   * recorded as studying and does not.
   *
   * There is no `enrollment.delete`. Academic history is cancelled or
   * superseded, never removed.
   */
  Enrollment: {
    View: 'enrollment.view',
    /** Placement at admission or readmission. */
    Create: 'enrollment.create',
    /** Individual and bulk promotion. */
    Promote: 'enrollment.promote',
    /** Correction and mid-year transfer — reason mandatory for both. */
    Correct: 'enrollment.correct',
    Cancel: 'enrollment.cancel',
    RollNumberManage: 'enrollment.rollnumber.manage',
    Export: 'enrollment.export',
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
  /**
   * Guardian records and their mapping to an applicant.
   *
   * Split from `Admissions` because a guardian record carries its own
   * sensitive fields (Aadhaar, address, income) independent of any one
   * application, and `Map`/`Unmap` are link operations rather than a create
   * or update of the guardian record itself.
   */
  Guardian: {
    View: 'guardian.view',
    Create: 'guardian.create',
    Update: 'guardian.update',
    Map: 'guardian.map',
    Unmap: 'guardian.unmap',
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
