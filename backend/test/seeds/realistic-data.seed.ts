import { PrismaClient } from '../../prisma/generated';
import * as bcrypt from 'bcrypt';

export async function seedRealisticData(prisma: PrismaClient) {
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
    if (error.code === 'P2002') {
      console.log(
        '[Test Seed] Seed data already exists (Unique constraint). Skipping seed.',
      );
    } else {
      throw error;
    }
  }
}
