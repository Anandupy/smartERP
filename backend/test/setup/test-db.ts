import { PrismaClient } from '../../prisma/generated';
import { seedRealisticData } from '../seeds/realistic-data.seed';

const prisma = new PrismaClient();

export async function truncateDb() {
  const tableNames = [
    'AcademicUnit',
    'AcademicYear',
    'Program',
    'RefreshToken',
    'User',
    'Branch',
    'Organization',
    'SystemSetting',
  ];

  try {
    for (const tableName of tableNames) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" CASCADE;`);
    }
  } catch (error) {
    console.error('Error truncating DB:', error);
  }
}

export async function resetSequences() {
  // Reset sequences if applicable (Postgres serials)
}

export async function reSeedBaseData() {
  await seedRealisticData(prisma);
}

export async function closeDbConnection() {
  await prisma.$disconnect();
}
