import { PrismaClient } from '../../prisma/generated';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UserRole } from '@/common/enums/role.enum';

export const createUser = async (
  prisma: PrismaClient,
  role: UserRole,
  orgId?: string,
  branchId?: string,
) => {
  const hash = await bcrypt.hash('Password123!', 10);
  const id = uuidv4();
  return prisma.user.create({
    data: {
      id,
      fullName: `Test ${role} ${Date.now()}`,
      username: `user_${id.substring(0, 8)}`,
      email: `${id}@test.com`,
      phone: `+91${Math.floor(Math.random() * 9000000000) + 1000000000}`,
      passwordHash: hash,
      role: role as any,
      organizationId: orgId,
      branchId: branchId,
    },
  });
};
