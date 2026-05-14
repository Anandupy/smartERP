import { Test, TestingModule } from '@nestjs/testing';
import { BcryptPasswordService } from '@/common/services/bcrypt-password.service';

describe('BcryptPasswordService', () => {
  let service: BcryptPasswordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BcryptPasswordService],
    }).compile();

    service = module.get<BcryptPasswordService>(BcryptPasswordService);
  });

  it('should hash and compare passwords correctly', async () => {
    const password = 'test-password';
    const hash = await service.hash(password);

    expect(hash).not.toBe(password);
    expect(await service.compare(password, hash)).toBe(true);
    expect(await service.compare('wrong-password', hash)).toBe(false);
  }, 10000);
});
