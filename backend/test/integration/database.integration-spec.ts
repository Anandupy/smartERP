import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AppModule } from '@/app.module';

describe('Database Integration', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.onModuleDestroy();
    }
  });

  it('should connect to the database', async () => {
    // Simple query to verify connection
    const result: any = await prisma.$queryRaw`SELECT 1 as result`;
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].result).toBe(1);
  });

  it('should be able to create and delete a temporary record transactionally', async () => {
    // We'll test transaction and rollback behavior using a raw query or simple operations
    const initialCount = await prisma.systemSetting.count();

    await prisma
      .$transaction(async (tx) => {
        const setting = await tx.systemSetting.create({
          data: {
            productName: 'Test Transaction',
            productCode: 'TX_TEST_' + Date.now(),
            version: '1.0.0',
            environment: 'DEV',
            supportEmail: 'tx@test.com',
            supportPhone: '1234567890',
          },
        });

        expect(setting.id).toBeDefined();

        const innerCount = await tx.systemSetting.count();
        expect(innerCount).toBe(initialCount + 1);

        // We explicitly throw an error to rollback the transaction
        throw new Error('Rollback transaction');
      })
      .catch((e) => {
        expect(e.message).toBe('Rollback transaction');
      });

    // Verify rollback
    const finalCount = await prisma.systemSetting.count();
    expect(finalCount).toBe(initialCount);
  });
});
