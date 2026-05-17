import { PartialType } from '@nestjs/swagger';
import { CreateAcademicUnitDto } from './create-academic-unit.dto';

export class UpdateAcademicUnitDto extends PartialType(CreateAcademicUnitDto) {}
