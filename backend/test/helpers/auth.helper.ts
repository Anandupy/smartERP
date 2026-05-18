import * as jwt from 'jsonwebtoken';
import { UserRole } from '@/common/enums/role.enum';

export const generateMockToken = (userId: string, role: UserRole) => {
  const payload = {
    sub: userId,
    role,
  };
  // Use a dummy secret for testing, or the real one if needed
  return jwt.sign(payload, 'test-secret', { expiresIn: '1h' });
};

export const getAuthHeaders = (token: string) => {
  return {
    Authorization: `Bearer ${token}`,
  };
};
