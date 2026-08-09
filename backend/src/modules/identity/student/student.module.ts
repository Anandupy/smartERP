import { Module } from '@nestjs/common';
import { StudentService } from './student.service';
import { StudentController } from './student.controller';
import { AuthorizationModule } from '@/modules/authorization/authorization.module';

/**
 * The permanent learner identity.
 *
 * Imports authorization (to test the organization-wide widening) and reaches
 * numbering, crypto and the outbox through their global modules. It imports
 * **no** business module: Admissions, Enrollment and every consumer depend on
 * Student, and an edge back would make the identity foundation unbuildable
 * without the things built on top of it.
 */
@Module({
  imports: [AuthorizationModule],
  controllers: [StudentController],
  providers: [StudentService],
  exports: [StudentService],
})
export class StudentModule {}
