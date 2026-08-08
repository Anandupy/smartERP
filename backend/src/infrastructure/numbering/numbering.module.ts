import { Global, Module } from '@nestjs/common';
import { NumberingService } from './numbering.service';
import { NumberingController } from './numbering.controller';

/**
 * The central business-identifier engine.
 *
 * Lives in `infrastructure/` rather than under `admissions/` because Student,
 * Employee, Finance and Certificates all allocate from it. Leaving it inside
 * admissions would force `identity/student` to import `admissions` to obtain a
 * student code — a back edge the dependency graph forbids (§46.2).
 */
@Global()
@Module({
  controllers: [NumberingController],
  providers: [NumberingService],
  exports: [NumberingService],
})
export class NumberingModule {}
