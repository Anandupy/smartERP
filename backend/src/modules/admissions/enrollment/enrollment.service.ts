import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { EnrollmentCompletedEvent } from '@/common/events';
import { CreateEnrollmentDto } from './dto/enrollment.dto';

@Injectable()
export class EnrollmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async createEnrollment(
    applicantId: string,
    dto: CreateEnrollmentDto,
    orgId: string,
    branchId: string,
    academicYearId: string,
  ) {
    // 1. Fetch applicant and verify status
    const applicant = await this.prisma.applicant.findUnique({
      where: { id: applicantId },
    });

    if (!applicant) {
      throw new NotFoundException('Applicant not found');
    }

    if (applicant.admissionStatus !== 'APPROVED') {
      throw new BadRequestException(
        `Cannot enroll applicant. Current status is ${applicant.admissionStatus}. Applicant must be APPROVED first.`,
      );
    }

    // 2. Verify Program exists
    const program = await this.prisma.program.findUnique({
      where: { id: dto.programId },
    });
    if (!program) {
      throw new NotFoundException('Program not found');
    }

    // 3. Verify AcademicUnit exists
    const academicUnit = await this.prisma.academicUnit.findUnique({
      where: { id: dto.academicUnitId },
    });
    if (!academicUnit) {
      throw new NotFoundException('Academic Unit not found');
    }

    // 4. Check duplicate enrollment
    const existing = await this.prisma.enrollment.findUnique({
      where: { applicantId },
    });
    if (existing) {
      throw new BadRequestException('Applicant is already enrolled');
    }

    // 5. Create enrollment
    const enrollment = await this.prisma.enrollment.create({
      data: {
        organizationId: orgId,
        branchId,
        academicYearId,
        programId: dto.programId,
        academicUnitId: dto.academicUnitId,
        applicantId,
        rollNumber: dto.rollNumber || null,
        enrollmentStatus: dto.enrollmentStatus || 'ACTIVE',
      },
      include: {
        program: true,
        academicUnit: true,
      },
    });

    await this.eventBus.publish(
      new EnrollmentCompletedEvent({
        applicantId: enrollment.applicantId,
        programId: enrollment.programId,
        academicUnitId: enrollment.academicUnitId,
        rollNumber: enrollment.rollNumber || undefined,
      }, {
        action: 'CREATE',
      }),
    );

    return enrollment;
  }

  async getEnrollment(applicantId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { applicantId },
      include: {
        program: true,
        academicUnit: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundException(
        'Enrollment record not found for this applicant',
      );
    }
    return enrollment;
  }
}
