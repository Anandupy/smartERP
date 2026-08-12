import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { PasswordService } from '@/common/services/password.service';
import { RoleType, MenuStatus, WorkspaceScopeType } from '@/generated/client';
import { PERMISSIONS } from '@/common/constants/permission.constants';

@Injectable()
export class SeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Seeds on boot in development, never in production.
   *
   * Automatic seeding writes a Super Admin with credentials taken from the
   * environment and rewrites the permission and menu catalogues. That is
   * convenient locally and unacceptable in production, where the same code path
   * would silently create a privileged account on every deploy. Production
   * seeds explicitly, through `pnpm seed`.
   */
  async onApplicationBootstrap() {
    if (this.isProduction()) {
      this.logger.log(
        'Bootstrap seeding is disabled in production. Run `pnpm seed` explicitly if reference data is required.',
      );
      return;
    }

    // Opt-out rather than opt-in: a developer who has not set the variable
    // still gets a usable database, which is the existing behaviour.
    if (this.isDisabled()) {
      this.logger.log('Bootstrap seeding disabled by SEED_ON_BOOTSTRAP=false.');
      return;
    }

    await this.run();
  }

  /**
   * Runs every seeder.
   *
   * Idempotent — each step upserts or checks for existence first — so it is
   * safe to invoke repeatedly and safe to invoke manually on a database that
   * has already been seeded.
   */
  async run() {
    await this.seedSuperAdmin();
    await this.seedAuthorizationData();
    await this.seedWorkspaceData();
  }

  private isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  /**
   * Whether `SEED_ON_BOOTSTRAP` explicitly disables seeding.
   *
   * `validateEnv` coerces the variable to a boolean and ConfigService returns
   * the validated value, so a string comparison against `'false'` never matched
   * and `.env.test` was silently seeding on every boot. Both forms are accepted
   * here because the raw string is still what appears in `process.env`.
   */
  private isDisabled(): boolean {
    const value = this.configService.get<boolean | string>('SEED_ON_BOOTSTRAP');

    return value === false || value === 'false';
  }

  private async seedSuperAdmin() {
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD');

    if (!adminEmail || !adminPassword) {
      this.logger.warn(
        'ADMIN_EMAIL or ADMIN_PASSWORD not set. Skipping Super Admin seeding.',
      );
      return;
    }

    const existing = await this.prisma.user.findFirst({
      where: { role: RoleType.SUPER_ADMIN },
    });

    if (existing) {
      this.logger.log('Super Admin already exists.');
      return;
    }

    const passwordHash = await this.passwordService.hash(adminPassword);

    await this.prisma.user.create({
      data: {
        fullName: 'Super Administrator',
        username: 'superadmin',
        email: adminEmail,
        phone: '0000000000',
        passwordHash,
        role: RoleType.SUPER_ADMIN,
        status: 'ACTIVE',
      },
    });

    this.logger.log(`Super Admin created with email: ${adminEmail}`);
  }

  private async seedAuthorizationData() {
    this.logger.log('Seeding Authorization Platform data...');

    const categoryDefinitions = [
      { code: 'STUDENTS', name: 'Students', displayOrder: 1 },
      { code: 'ADMISSIONS', name: 'Admissions', displayOrder: 2 },
      { code: 'FEES', name: 'Fees', displayOrder: 3 },
      { code: 'ATTENDANCE', name: 'Attendance', displayOrder: 4 },
      { code: 'HR', name: 'HR & Payroll', displayOrder: 5 },
      { code: 'LIBRARY', name: 'Library', displayOrder: 6 },
      { code: 'INVENTORY', name: 'Inventory', displayOrder: 7 },
      { code: 'SETTINGS', name: 'Settings', displayOrder: 8 },
      { code: 'REPORTS', name: 'Reports', displayOrder: 9 },
      { code: 'SYSTEM', name: 'System', displayOrder: 10 },
      { code: 'AUDIT', name: 'Audit', displayOrder: 11 },
      { code: 'COMMUNICATION', name: 'Communication', displayOrder: 12 },
      { code: 'IDENTITY', name: 'Identity', displayOrder: 13 },
    ];

    const categoryMap = new Map<string, string>();

    for (const cat of categoryDefinitions) {
      const dbCat = await this.prisma.permissionCategory.upsert({
        where: { code: cat.code },
        update: { name: cat.name, displayOrder: cat.displayOrder },
        create: {
          code: cat.code,
          name: cat.name,
          displayOrder: cat.displayOrder,
          isSystem: true,
        },
      });
      categoryMap.set(cat.code, dbCat.id);
    }

    const permissionSeedData: Array<{
      name: string;
      categoryCode: string;
      description: string;
    }> = [
      // Identity
      //
      // Separate from Students because Person is the human, not the learner: the
      // same row is also a guardian and an employee, and it exists before any of
      // them. Revealing a full government identifier is deliberately not a
      // permission here — that ships with the access log that records who read
      // what and why.
      {
        name: PERMISSIONS.Person.View,
        categoryCode: 'IDENTITY',
        description: 'View an identity record and its masked identifiers',
      },
      {
        name: PERMISSIONS.Person.Search,
        categoryCode: 'IDENTITY',
        description: 'Search for identities that may be the same human',
      },
      {
        name: PERMISSIONS.Person.Correct,
        categoryCode: 'IDENTITY',
        description: 'Record identity match decisions and corrections',
      },
      {
        name: PERMISSIONS.Person.AttachGovernmentId,
        categoryCode: 'IDENTITY',
        description: 'Bind a government identifier to an identity',
      },

      // Student
      {
        name: PERMISSIONS.Student.View,
        categoryCode: 'STUDENTS',
        description: 'View student details',
      },
      {
        name: PERMISSIONS.Student.Search,
        categoryCode: 'STUDENTS',
        description: 'Search students and resolve student codes',
      },
      {
        name: PERMISSIONS.Student.ViewOrganization,
        categoryCode: 'STUDENTS',
        description:
          'Search students across every branch in the organization (reduced projection outside the caller branch)',
      },
      {
        name: PERMISSIONS.Student.Create,
        categoryCode: 'STUDENTS',
        description: 'Create new student',
      },
      {
        name: PERMISSIONS.Student.Update,
        categoryCode: 'STUDENTS',
        description: 'Update student details',
      },
      {
        name: PERMISSIONS.Student.Delete,
        categoryCode: 'STUDENTS',
        description: 'Delete student record',
      },
      {
        name: PERMISSIONS.Student.Export,
        categoryCode: 'STUDENTS',
        description: 'Export student records',
      },
      {
        name: PERMISSIONS.Student.Print,
        categoryCode: 'STUDENTS',
        description: 'Print student profiles',
      },

      // Enrollment — academic placement
      {
        name: PERMISSIONS.Enrollment.View,
        categoryCode: 'STUDENTS',
        description: 'View academic placements and class lists',
      },
      {
        name: PERMISSIONS.Enrollment.Create,
        categoryCode: 'STUDENTS',
        description: 'Place a student for an academic year',
      },
      {
        name: PERMISSIONS.Enrollment.Promote,
        categoryCode: 'STUDENTS',
        description: 'Promote or detain a student into the next academic year',
      },
      {
        name: PERMISSIONS.Enrollment.Correct,
        categoryCode: 'STUDENTS',
        description:
          'Correct a placement or move a student mid-year within the branch (reason mandatory)',
      },
      {
        name: PERMISSIONS.Enrollment.Cancel,
        categoryCode: 'STUDENTS',
        description: 'Cancel an academic placement (reason mandatory)',
      },
      {
        name: PERMISSIONS.Enrollment.RollNumberManage,
        categoryCode: 'STUDENTS',
        description: 'Assign and regenerate class-register roll numbers',
      },
      {
        name: PERMISSIONS.Enrollment.Export,
        categoryCode: 'STUDENTS',
        description: 'Export class lists and placement records',
      },

      // Admissions
      {
        name: PERMISSIONS.Admissions.View,
        categoryCode: 'ADMISSIONS',
        description: 'View admission applications',
      },
      {
        name: PERMISSIONS.Admissions.Create,
        categoryCode: 'ADMISSIONS',
        description: 'Create admission application',
      },
      {
        name: PERMISSIONS.Admissions.Update,
        categoryCode: 'ADMISSIONS',
        description: 'Update application details',
      },
      {
        name: PERMISSIONS.Admissions.Delete,
        categoryCode: 'ADMISSIONS',
        description: 'Delete application',
      },
      {
        name: PERMISSIONS.Admissions.Approve,
        categoryCode: 'ADMISSIONS',
        description: 'Approve application',
      },
      {
        name: PERMISSIONS.Admissions.Reject,
        categoryCode: 'ADMISSIONS',
        description: 'Reject application',
      },
      {
        name: PERMISSIONS.Admissions.Export,
        categoryCode: 'ADMISSIONS',
        description: 'Export admissions data',
      },

      // Guardian
      {
        name: PERMISSIONS.Guardian.View,
        categoryCode: 'ADMISSIONS',
        description: 'View guardian records and applicant mappings',
      },
      {
        name: PERMISSIONS.Guardian.Create,
        categoryCode: 'ADMISSIONS',
        description: 'Create a guardian record',
      },
      {
        name: PERMISSIONS.Guardian.Update,
        categoryCode: 'ADMISSIONS',
        description: 'Update a guardian record',
      },
      {
        name: PERMISSIONS.Guardian.Map,
        categoryCode: 'ADMISSIONS',
        description: 'Map a guardian to an applicant',
      },
      {
        name: PERMISSIONS.Guardian.Unmap,
        categoryCode: 'ADMISSIONS',
        description: 'Remove a guardian mapping from an applicant',
      },

      // Fees
      {
        name: PERMISSIONS.Fees.View,
        categoryCode: 'FEES',
        description: 'View fee structures & logs',
      },
      {
        name: PERMISSIONS.Fees.Collect,
        categoryCode: 'FEES',
        description: 'Collect fee payments',
      },
      {
        name: PERMISSIONS.Fees.Refund,
        categoryCode: 'FEES',
        description: 'Process fee refund',
      },
      {
        name: PERMISSIONS.Fees.Discount,
        categoryCode: 'FEES',
        description: 'Apply fee discount',
      },
      {
        name: PERMISSIONS.Fees.Report,
        categoryCode: 'FEES',
        description: 'Generate fee reports',
      },

      // Attendance
      {
        name: PERMISSIONS.Attendance.View,
        categoryCode: 'ATTENDANCE',
        description: 'View attendance records',
      },
      {
        name: PERMISSIONS.Attendance.Mark,
        categoryCode: 'ATTENDANCE',
        description: 'Mark student attendance',
      },
      {
        name: PERMISSIONS.Attendance.Edit,
        categoryCode: 'ATTENDANCE',
        description: 'Edit attendance records',
      },
      {
        name: PERMISSIONS.Attendance.Report,
        categoryCode: 'ATTENDANCE',
        description: 'Generate attendance reports',
      },

      // Settings
      {
        name: PERMISSIONS.Settings.View,
        categoryCode: 'SETTINGS',
        description: 'View application settings',
      },
      {
        name: PERMISSIONS.Settings.Manage,
        categoryCode: 'SETTINGS',
        description: 'Manage settings & permissions',
      },

      // Audit
      {
        name: PERMISSIONS.Audit.View,
        categoryCode: 'AUDIT',
        description: 'View audit logs',
      },
      {
        name: PERMISSIONS.Audit.Export,
        categoryCode: 'AUDIT',
        description: 'Export audit logs',
      },

      // System
      //
      // These gate System Settings and Maintenance Rules. They were enforced by
      // those controllers but never created here, so the routes were
      // unreachable by every role — SUPER_ADMIN included, because its bypass
      // grants "all active permissions" and these had no rows to grant.
      {
        name: PERMISSIONS.System.View,
        categoryCode: 'SYSTEM',
        description: 'View system settings and maintenance rules',
      },
      {
        name: PERMISSIONS.System.Manage,
        categoryCode: 'SYSTEM',
        description: 'Manage system settings',
      },
      {
        name: PERMISSIONS.System.Maintenance,
        categoryCode: 'SYSTEM',
        description: 'Create and manage maintenance rules',
      },

      // Communication
      {
        name: PERMISSIONS.Communication.View,
        categoryCode: 'COMMUNICATION',
        description: 'View communications',
      },
      {
        name: PERMISSIONS.Communication.Send,
        categoryCode: 'COMMUNICATION',
        description: 'Send notifications',
      },
      {
        name: PERMISSIONS.Communication.TemplateManage,
        categoryCode: 'COMMUNICATION',
        description: 'Manage templates',
      },
    ];

    const permissionMap = new Map<string, string>();

    for (const p of permissionSeedData) {
      const categoryId = categoryMap.get(p.categoryCode)!;
      const dbPerm = await this.prisma.permission.upsert({
        where: { name: p.name },
        update: { categoryId, description: p.description },
        create: {
          name: p.name,
          categoryId,
          description: p.description,
          isSystem: true,
        },
      });
      permissionMap.set(p.name, dbPerm.id);
    }

    // Default Role Permission Mappings
    const orgAdminPerms = [
      PERMISSIONS.Student.View,
      PERMISSIONS.Student.Create,
      PERMISSIONS.Student.Update,
      PERMISSIONS.Student.Delete,
      PERMISSIONS.Student.Export,
      PERMISSIONS.Student.Print,
      PERMISSIONS.Admissions.View,
      PERMISSIONS.Admissions.Create,
      PERMISSIONS.Admissions.Update,
      PERMISSIONS.Admissions.Delete,
      PERMISSIONS.Admissions.Approve,
      PERMISSIONS.Admissions.Reject,
      PERMISSIONS.Admissions.Export,
      PERMISSIONS.Guardian.View,
      PERMISSIONS.Guardian.Create,
      PERMISSIONS.Guardian.Update,
      PERMISSIONS.Guardian.Map,
      PERMISSIONS.Guardian.Unmap,
      PERMISSIONS.Fees.View,
      PERMISSIONS.Fees.Collect,
      PERMISSIONS.Fees.Refund,
      PERMISSIONS.Fees.Discount,
      PERMISSIONS.Fees.Report,
      PERMISSIONS.Attendance.View,
      PERMISSIONS.Attendance.Mark,
      PERMISSIONS.Attendance.Edit,
      PERMISSIONS.Attendance.Report,
      PERMISSIONS.Settings.View,
      PERMISSIONS.Settings.Manage,
      PERMISSIONS.Audit.View,
      PERMISSIONS.Audit.Export,
      PERMISSIONS.Communication.View,
      PERMISSIONS.Communication.Send,
      PERMISSIONS.Communication.TemplateManage,
    ];

    const branchAdminPerms = [
      PERMISSIONS.Student.View,
      PERMISSIONS.Student.Create,
      PERMISSIONS.Student.Update,
      PERMISSIONS.Student.Export,
      PERMISSIONS.Student.Print,
      PERMISSIONS.Admissions.View,
      PERMISSIONS.Admissions.Create,
      PERMISSIONS.Admissions.Update,
      PERMISSIONS.Admissions.Approve,
      PERMISSIONS.Admissions.Reject,
      PERMISSIONS.Guardian.View,
      PERMISSIONS.Guardian.Create,
      PERMISSIONS.Guardian.Update,
      PERMISSIONS.Guardian.Map,
      PERMISSIONS.Guardian.Unmap,
      PERMISSIONS.Fees.View,
      PERMISSIONS.Fees.Collect,
      PERMISSIONS.Fees.Report,
      PERMISSIONS.Attendance.View,
      PERMISSIONS.Attendance.Mark,
      PERMISSIONS.Attendance.Edit,
      PERMISSIONS.Attendance.Report,
      PERMISSIONS.Settings.View,
      PERMISSIONS.Audit.View,
      PERMISSIONS.Communication.View,
      PERMISSIONS.Communication.Send,
    ];

    const staffPerms = [
      PERMISSIONS.Student.View,
      PERMISSIONS.Admissions.View,
      PERMISSIONS.Admissions.Create,
      PERMISSIONS.Admissions.Update,
      PERMISSIONS.Guardian.View,
      PERMISSIONS.Fees.View,
      PERMISSIONS.Fees.Collect,
      PERMISSIONS.Attendance.View,
      PERMISSIONS.Attendance.Mark,
      PERMISSIONS.Communication.View,
    ];

    const studentParentPerms = [
      PERMISSIONS.Student.View,
      PERMISSIONS.Attendance.View,
      PERMISSIONS.Fees.View,
      PERMISSIONS.Communication.View,
    ];

    const roleMappingConfigs: Array<{ role: RoleType; perms: string[] }> = [
      { role: RoleType.ORG_ADMIN, perms: orgAdminPerms },
      { role: RoleType.BRANCH_ADMIN, perms: branchAdminPerms },
      { role: RoleType.STAFF, perms: staffPerms },
      { role: RoleType.STUDENT, perms: studentParentPerms },
      { role: RoleType.PARENT, perms: studentParentPerms },
    ];

    for (const config of roleMappingConfigs) {
      for (const permName of config.perms) {
        const permId = permissionMap.get(permName);
        if (permId) {
          await this.prisma.rolePermission.upsert({
            where: {
              role_permissionId: {
                role: config.role,
                permissionId: permId,
              },
            },
            update: {},
            create: {
              role: config.role,
              permissionId: permId,
            },
          });
        }
      }
    }

    this.logger.log('Authorization Platform seeding completed successfully.');
  }

  private async seedWorkspaceData() {
    this.logger.log('Seeding Workspace Platform modules and menus...');

    const moduleDefinitions = [
      { code: 'ADMISSIONS', name: 'Admissions Management', displayOrder: 1 },
      { code: 'STUDENTS', name: 'Student Management', displayOrder: 2 },
      { code: 'FEES', name: 'Fee Management', displayOrder: 3 },
      { code: 'SETTINGS', name: 'System Settings', displayOrder: 4 },
      { code: 'SYSTEM', name: 'System Administration', displayOrder: 5 },
      {
        code: 'COMMUNICATION',
        name: 'Communication Platform',
        displayOrder: 6,
      },
    ];

    const moduleMap = new Map<string, string>();

    for (const modDef of moduleDefinitions) {
      const dbMod = await this.prisma.module.upsert({
        where: { code: modDef.code },
        update: { name: modDef.name, displayOrder: modDef.displayOrder },
        create: {
          code: modDef.code,
          name: modDef.name,
          displayOrder: modDef.displayOrder,
          isSystem: true,
          isActive: true,
        },
      });
      moduleMap.set(modDef.code, dbMod.id);
    }

    // Seed Core Menus
    const menuSeedData = [
      // Admissions
      {
        code: 'ADMISSIONS_APPLICANTS',
        moduleCode: 'ADMISSIONS',
        route: '/admissions/applicants',
        displayName: 'Applicants List',
        icon: 'users',
        permissions: [PERMISSIONS.Admissions.View],
        displayOrder: 1,
      },
      {
        code: 'ADMISSIONS_REGISTER',
        moduleCode: 'ADMISSIONS',
        route: '/admissions/applicants/new',
        displayName: 'Register Applicant',
        icon: 'user-plus',
        permissions: [PERMISSIONS.Admissions.Create],
        displayOrder: 2,
      },
      // Settings
      {
        code: 'SETTINGS_ORGANIZATIONS',
        moduleCode: 'SETTINGS',
        route: '/organizations',
        displayName: 'Organizations',
        icon: 'building',
        permissions: [PERMISSIONS.Settings.View],
        displayOrder: 1,
      },
      {
        code: 'SETTINGS_BRANCHES',
        moduleCode: 'SETTINGS',
        route: '/branches',
        displayName: 'Branches',
        icon: 'git-branch',
        permissions: [PERMISSIONS.Settings.View],
        displayOrder: 2,
      },
      {
        code: 'SETTINGS_ACADEMIC_YEARS',
        moduleCode: 'SETTINGS',
        route: '/academic-years',
        displayName: 'Academic Years',
        icon: 'calendar',
        permissions: [PERMISSIONS.Settings.View],
        displayOrder: 3,
      },
      {
        code: 'SETTINGS_PROGRAMS',
        moduleCode: 'SETTINGS',
        route: '/programs',
        displayName: 'Programs',
        icon: 'book',
        permissions: [PERMISSIONS.Settings.View],
        displayOrder: 4,
      },
      {
        code: 'SETTINGS_ACADEMIC_UNITS',
        moduleCode: 'SETTINGS',
        route: '/academic-units',
        displayName: 'Academic Units',
        icon: 'grid',
        permissions: [PERMISSIONS.Settings.View],
        displayOrder: 5,
      },
      // System
      {
        code: 'SYSTEM_MAINTENANCE',
        moduleCode: 'SYSTEM',
        route: '/maintenance-rules',
        displayName: 'Maintenance Rules',
        icon: 'shield',
        permissions: [PERMISSIONS.System.View],
        displayOrder: 1,
      },
      {
        code: 'SYSTEM_AUTHORIZATION',
        moduleCode: 'SYSTEM',
        route: '/authorization',
        displayName: 'Authorization & Permissions',
        icon: 'key',
        permissions: [PERMISSIONS.Settings.Manage],
        displayOrder: 2,
      },
    ];

    for (const menuDef of menuSeedData) {
      const moduleId = moduleMap.get(menuDef.moduleCode);
      if (moduleId) {
        await this.prisma.menu.upsert({
          where: { code: menuDef.code },
          update: {
            displayName: menuDef.displayName,
            route: menuDef.route,
            permissions: menuDef.permissions,
          },
          create: {
            code: menuDef.code,
            moduleId,
            route: menuDef.route,
            displayName: menuDef.displayName,
            icon: menuDef.icon,
            permissions: menuDef.permissions,
            displayOrder: menuDef.displayOrder,
            status: MenuStatus.ACTIVE,
            isSystem: true,
          },
        });
      }
    }

    // Seed Global Product Workspace Configuration
    const existingConfig = await this.prisma.workspaceConfiguration.findFirst({
      where: { scopeType: WorkspaceScopeType.PRODUCT, scopeId: null },
    });

    if (!existingConfig) {
      await this.prisma.workspaceConfiguration.create({
        data: {
          scopeType: WorkspaceScopeType.PRODUCT,
          scopeId: null,
          navigationPreferences: {
            sidebarCollapsed: false,
            sidebarPosition: 'left',
            denseMode: false,
            defaultRoute: '/dashboard',
          },
          clientPreferences: {
            theme: 'system',
            locale: 'en',
          },
        },
      });
    }

    this.logger.log('Workspace Platform seeding completed successfully.');
  }
}
