import { PartialType } from '@nestjs/swagger';
import { CreateMaintenanceRuleDto } from './create-maintenance-rule.dto';

export class UpdateMaintenanceRuleDto extends PartialType(CreateMaintenanceRuleDto) {}
