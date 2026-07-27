import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { PasswordService } from '@/common/services/password.service';
import { RoleType } from '@prisma/client';
import { PERMISSIONS } from '@/common/constants/permission.constants';

@Injectable()
export class SeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    await this.seedSuperAdmin();
    await this.seedAuthorizationData();
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
      // Student
      {
        name: PERMISSIONS.Student.View,
        categoryCode: 'STUDENTS',
        description: 'View student details',
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
}
