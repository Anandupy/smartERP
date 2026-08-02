import { PrismaClient } from '../../prisma/generated';
import * as bcrypt from 'bcrypt';

export async function seedRealisticData(prisma: PrismaClient) {
  // 0. Seed Communication Templates
  const templates = [
    {
      code: 'PASSWORD_RESET',
      name: 'Password Reset Template',
      description: 'Template for requesting password reset via link or OTP',
      channel: 'EMAIL',
      category: 'AUTHENTICATION',
      subject: 'Reset Your Password',
      bodyHtml: '<h2>Hello {{userName}},</h2><p>You requested a password reset. Please click the link below to reset your password:</p><p><a href="{{resetLink}}">Reset Password</a></p><p>Or use OTP: <strong>{{otp}}</strong></p><p>This link/OTP will expire in {{minutes}} minutes.</p>',
      bodyText: 'Hello {{userName}},\n\nYou requested a password reset. Please reset your password by opening the link:\n{{resetLink}}\n\nOr use OTP: {{otp}}\n\nThis will expire in {{minutes}} minutes.',
      variables: ['userName', 'resetLink', 'otp', 'minutes'],
      language: 'en',
      version: 1,
      status: 'PUBLISHED',
    },
    {
      code: 'PASSWORD_CHANGED',
      name: 'Password Changed Confirmation',
      description: 'Confirmation sent after successful password update',
      channel: 'EMAIL',
      category: 'AUTHENTICATION',
      subject: 'Security Alert: Password Changed',
      bodyHtml: '<h2>Hello {{userName}},</h2><p>Your password was successfully changed. If you did not make this change, please contact support immediately.</p>',
      bodyText: 'Hello {{userName}},\n\nYour password was successfully changed. If you did not make this change, please contact support immediately.',
      variables: ['userName'],
      language: 'en',
      version: 1,
      status: 'PUBLISHED',
    },
    {
      code: 'EMAIL_VERIFICATION',
      name: 'Email Verification OTP',
      description: 'Template for verifying user email address',
      channel: 'EMAIL',
      category: 'AUTHENTICATION',
      subject: 'Verify Your Email Address',
      bodyHtml: '<h2>Hello,</h2><p>Please verify your email address by entering the following OTP: <strong>{{otp}}</strong></p>',
      bodyText: 'Hello,\n\nPlease verify your email address by entering the following OTP: {{otp}}',
      variables: ['otp'],
      language: 'en',
      version: 1,
      status: 'PUBLISHED',
    },
    {
      code: 'OTP_VERIFICATION',
      name: 'OTP Verification Template',
      description: 'General template for OTP verification',
      channel: 'EMAIL',
      category: 'AUTHENTICATION',
      subject: 'Your One-Time Password (OTP)',
      bodyHtml: '<h2>Hello,</h2><p>Your OTP for verification is: <strong>{{otp}}</strong></p>',
      bodyText: 'Hello,\n\nYour OTP for verification is: {{otp}}',
      variables: ['otp'],
      language: 'en',
      version: 1,
      status: 'PUBLISHED',
    },
  ];

  for (const t of templates) {
    try {
      const existing = await prisma.communicationTemplate.findFirst({
        where: { code: t.code, channel: t.channel as any },
      });
      if (!existing) {
        await prisma.communicationTemplate.create({
          data: {
            code: t.code,
            name: t.name,
            description: t.description,
            channel: t.channel as any,
            category: t.category as any,
            subject: t.subject,
            bodyHtml: t.bodyHtml,
            bodyText: t.bodyText,
            variables: t.variables,
            language: t.language,
            version: t.version,
            status: t.status as any,
          },
        });
      }
    } catch (err) {
      console.log(
        `[Test Seed] Template ${t.code} seeding skipped:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  try {
    // 1. Create Super Admin
    const passwordHash = await bcrypt.hash('Admin@123!', 10);
    const superAdmin = await prisma.user.create({
      data: {
        fullName: 'System Super Admin',
        username: 'superadmin',
        email: 'admin@erp.com',
        phone: '9999999999',
        passwordHash,
        role: 'SUPER_ADMIN',
      },
    });

    // 2. Create System Settings
    await prisma.systemSetting.create({
      data: {
        productName: 'Vidya ERP',
        productCode: 'VERP',
        version: '1.0.0',
        environment: 'DEV',
        supportEmail: 'support@vidyaerp.in',
        supportPhone: '1800112233',
      },
    });

    // 3. Create Organizations
    const horizonOrg = await prisma.organization.create({
      data: {
        name: 'Horizon Education Trust',
        code: 'HET',
        contactEmail: 'contact@horizon.edu.in',
        contactPhone: '02221234567',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        masterExpiryDate: new Date('2030-12-31'),
      },
    });

    const vidyadeepOrg = await prisma.organization.create({
      data: {
        name: 'VidyaDeep Group of Institutions',
        code: 'VDGI',
        contactEmail: 'info@vidyadeep.edu.in',
        contactPhone: '02532123456',
        city: 'Nashik',
        state: 'Maharashtra',
        country: 'India',
        masterExpiryDate: new Date('2030-12-31'),
      },
    });

    const saraswatiOrg = await prisma.organization.create({
      data: {
        name: 'Saraswati National Education Society',
        code: 'SNES',
        contactEmail: 'admin@saraswati.edu.in',
        contactPhone: '01412123456',
        city: 'Jaipur',
        state: 'Rajasthan',
        country: 'India',
        masterExpiryDate: new Date('2030-12-31'),
      },
    });

    // 4. Create Branches
    const horizonMumbai = await prisma.branch.create({
      data: {
        organizationId: horizonOrg.id,
        name: 'Horizon Public School Mumbai',
        code: 'HPSM',
        institutionType: 'SCHOOL',
        affiliationType: 'BOARD',
        affiliationName: 'CBSE',
        contactEmail: 'mumbai@horizon.edu.in',
        contactPhone: '02227654321',
        addressLine1: 'Andheri West',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        pincode: '400053',
      },
    });

    const horizonPune = await prisma.branch.create({
      data: {
        organizationId: horizonOrg.id,
        name: 'Horizon Junior College Pune',
        code: 'HJCP',
        institutionType: 'JUNIOR_COLLEGE',
        affiliationType: 'BOARD',
        affiliationName: 'HSC',
        contactEmail: 'pune@horizon.edu.in',
        contactPhone: '02027654321',
        addressLine1: 'Shivaji Nagar',
        city: 'Pune',
        state: 'Maharashtra',
        country: 'India',
        pincode: '411005',
      },
    });

    // 5. Create Academic Years
    const academicYear24 = await prisma.academicYear.create({
      data: {
        branchId: horizonMumbai.id,
        name: '2024-25',
        startDate: new Date('2024-04-01'),
        endDate: new Date('2025-03-31'),
        isActive: true,
        isSelected: true,
      },
    });

    const academicYear25 = await prisma.academicYear.create({
      data: {
        branchId: horizonMumbai.id,
        name: '2025-26',
        startDate: new Date('2025-04-01'),
        endDate: new Date('2026-03-31'),
        isActive: false,
      },
    });

    // 6. Create Programs
    const primaryProgram = await prisma.program.create({
      data: {
        branchId: horizonMumbai.id,
        name: 'Primary English Medium',
        level: 'SCHOOL',
        medium: 'English',
      },
    });

    const secondaryProgram = await prisma.program.create({
      data: {
        branchId: horizonMumbai.id,
        name: 'Secondary English Medium',
        level: 'SCHOOL',
        medium: 'English',
      },
    });

    // 7. Create Academic Units
    const grade1 = await prisma.academicUnit.create({
      data: {
        branchId: horizonMumbai.id,
        programId: primaryProgram.id,
        academicYearId: academicYear24.id,
        name: 'Grade 1',
        unitType: 'CLASS',
        level: 1,
      },
    });

    await prisma.academicUnit.create({
      data: {
        branchId: horizonMumbai.id,
        programId: primaryProgram.id,
        academicYearId: academicYear24.id,
        parentId: grade1.id,
        name: 'Division A',
        unitType: 'DIVISION',
        level: 2,
      },
    });

    await prisma.academicUnit.create({
      data: {
        branchId: horizonMumbai.id,
        programId: primaryProgram.id,
        academicYearId: academicYear24.id,
        parentId: grade1.id,
        name: 'Division B',
        unitType: 'DIVISION',
        level: 2,
      },
    });

    const grade2 = await prisma.academicUnit.create({
      data: {
        branchId: horizonMumbai.id,
        programId: primaryProgram.id,
        academicYearId: academicYear24.id,
        name: 'Grade 2',
        unitType: 'CLASS',
        level: 1,
      },
    });

    await prisma.academicUnit.create({
      data: {
        branchId: horizonMumbai.id,
        programId: primaryProgram.id,
        academicYearId: academicYear24.id,
        parentId: grade2.id,
        name: 'Division A',
        unitType: 'DIVISION',
        level: 2,
      },
    });

    // 8. Create Users for Org and Branch
    await prisma.user.create({
      data: {
        fullName: 'Horizon Org Admin',
        username: 'horizonadmin',
        email: 'admin@horizon.edu.in',
        phone: '9876543210',
        passwordHash,
        role: 'ORG_ADMIN',
        organizationId: horizonOrg.id,
      },
    });

    await prisma.user.create({
      data: {
        fullName: 'Mumbai Branch Admin',
        username: 'mumbaiadmin',
        email: 'mumbaiadmin@horizon.edu.in',
        phone: '9876543211',
        passwordHash,
        role: 'BRANCH_ADMIN',
        organizationId: horizonOrg.id,
        branchId: horizonMumbai.id,
      },
    });

  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') {
      console.log(
        '[Test Seed] Seed data already exists (Unique constraint). Skipping seed.',
      );
    } else {
      throw error;
    }
  }
}
