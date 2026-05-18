import { PrismaClient } from '../../prisma/generated';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

export const mockPrisma = mockDeep<PrismaClient>();
export type Context = {
  prisma: PrismaClient;
};

export type MockContext = {
  prisma: DeepMockProxy<PrismaClient>;
};

export const createMockContext = (): MockContext => {
  return {
    prisma: mockDeep<PrismaClient>(),
  };
};
