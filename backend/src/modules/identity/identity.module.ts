import { Module } from '@nestjs/common';
import { PersonModule } from './person/person.module';
import { StudentModule } from './student/student.module';

/**
 * Identity core.
 *
 * Person and Student. Grouped so the dependency rule is
 * visible in the folder structure: everything under `identity/` may be imported
 * by admissions, enrollment and every downstream module, and may import none of
 * them.
 */
@Module({
  imports: [PersonModule, StudentModule],
  exports: [PersonModule, StudentModule],
})
export class IdentityModule {}
