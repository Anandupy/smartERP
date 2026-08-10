import { Module } from '@nestjs/common';
import { EnrollmentService } from './enrollment.service';
import { EnrollmentController } from './enrollment.controller';
import { EnrollmentConfigProvider } from './enrollment-config.provider';
import { AuthorizationModule } from '@/modules/authorization/authorization.module';

/**
 * The academic-placement spine.
 *
 * Imports authorization (each operation declares its own permission) and reaches
 * the database, the outbox and the row-lock helper through their global modules.
 *
 * It imports **no business module**, and in particular not Admissions. The
 * schema holds an `admissionId`; a TypeScript edge back to the intake funnel
 * would make a twelve-year concern unbuildable without the three-month one, and
 * would put Attendance → Admissions in every future dependency graph.
 */
@Module({
  imports: [AuthorizationModule],
  controllers: [EnrollmentController],
  providers: [EnrollmentService, EnrollmentConfigProvider],
  exports: [EnrollmentService],
})
export class EnrollmentModule {}
