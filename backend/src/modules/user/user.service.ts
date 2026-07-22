import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { UserCreatedEvent, UserUpdatedEvent } from '@/common/events';
import { PasswordService } from '@/common/services/password.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly eventBus: EventBus,
  ) {}

  async createUser(dto: CreateUserDto, creatorId?: string) {
    const { password, ...userData } = dto;

    // Check uniqueness
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email },
          { username: dto.username },
          { phone: dto.phone },
        ],
      },
    });

    if (existing) {
      if (existing.email === dto.email)
        throw new ConflictException('Email already exists');
      if (existing.username === dto.username)
        throw new ConflictException('Username already exists');
      if (existing.phone === dto.phone)
        throw new ConflictException('Phone number already exists');
    }

    const passwordHash = await this.passwordService.hash(password);

    const user = await this.prisma.user.create({
      data: {
        ...userData,
        passwordHash,
        createdBy: creatorId,
        updatedBy: creatorId,
      },
      select: this.userSelect(),
    });

    await this.eventBus.publish(
      new UserCreatedEvent({
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      }),
    );

    return user;
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.userSelect(),
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByIdentifier(identifier: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier },
          { phone: identifier },
        ],
      },
    });
  }

  async updateUser(id: string, dto: UpdateUserDto, updaterId?: string) {
    await this.findById(id);

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...dto,
        updatedBy: updaterId,
      },
      select: this.userSelect(),
    });

    await this.eventBus.publish(
      new UserUpdatedEvent({
        userId: updated.id,
        fullName: updated.fullName,
        role: updated.role,
      }),
    );

    return updated;
  }

  private userSelect() {
    return {
      id: true,
      fullName: true,
      username: true,
      email: true,
      phone: true,
      role: true,
      organizationId: true,
      branchId: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    };
  }
}
