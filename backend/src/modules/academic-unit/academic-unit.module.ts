import { Module } from '@nestjs/common';
import { AcademicUnitService } from './academic-unit.service';
import { AcademicUnitController } from './academic-unit.controller';

@Module({
  controllers: [AcademicUnitController],
  providers: [AcademicUnitService],
  exports: [AcademicUnitService],
})
export class AcademicUnitModule {}
