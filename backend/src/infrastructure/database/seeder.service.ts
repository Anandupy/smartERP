import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { PasswordService } from '@/common/services/password.service';
import { RoleType } from '@/generated/client';

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
  }

  private async seedSuperAdmin() {
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD');

    if (!adminEmail || !adminPassword) {
      this.logger.warn('ADMIN_EMAIL or ADMIN_PASSWORD not set. Skipping Super Admin seeding.');
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
}
