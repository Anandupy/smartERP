import { Test, TestingModule } from '@nestjs/testing';
import { PasswordService } from '@/common/services/password.service';
import { BcryptPasswordService } from '@/common/services/bcrypt-password.service';

describe('PasswordService (Unit)', () => {
  let service: PasswordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PasswordService,
          useClass: BcryptPasswordService,
        },
      ],
    }).compile();

    service = module.get<PasswordService>(PasswordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should hash a password', async () => {
    const hash = await service.hash('Test@123');
    expect(hash).toBeDefined();
    expect(hash).not.toBe('Test@123');
  });

  it('should verify a correct password', async () => {
    const hash = await service.hash('Test@123');
    const isMatch = await service.compare('Test@123', hash);
    expect(isMatch).toBe(true);
  });

  it('should reject an incorrect password', async () => {
    const hash = await service.hash('Test@123');
    const isMatch = await service.compare('Wrong@123', hash);
    expect(isMatch).toBe(false);
  });
});
