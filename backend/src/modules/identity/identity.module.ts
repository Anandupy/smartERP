import { Module } from '@nestjs/common';
import { PersonModule } from './person/person.module';

/**
 * Identity core.
 *
 * Person today; Student joins it in Phase 2. Grouped so the dependency rule is
 * visible in the folder structure: everything under `identity/` may be imported
 * by admissions, enrollment and every downstream module, and may import none of
 * them.
 */
@Module({
  imports: [PersonModule],
  exports: [PersonModule],
})
export class IdentityModule {}
