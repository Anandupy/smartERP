import { Module } from '@nestjs/common';
import { ReligionService } from './religion/religion.service';
import { ReligionController } from './religion/religion.controller';
import { CasteService } from './caste/caste.service';
import { CasteController } from './caste/caste.controller';
import { CategoryService } from './category/category.service';
import { CategoryController } from './category/category.controller';
import { GenderService } from './gender/gender.service';
import { GenderController } from './gender/gender.controller';
import { BloodGroupService } from './blood-group/blood-group.service';
import { BloodGroupController } from './blood-group/blood-group.controller';
import { LanguageService } from './language/language.service';
import { LanguageController } from './language/language.controller';
import { DisabilityService } from './disability/disability.service';
import { DisabilityController } from './disability/disability.controller';
import { RelationTypeService } from './relation-type/relation-type.service';
import { RelationTypeController } from './relation-type/relation-type.controller';
import { QuotaService } from './quota/quota.service';
import { QuotaController } from './quota/quota.controller';
import { AdmissionSourceService } from './admission-source/admission-source.service';
import { AdmissionSourceController } from './admission-source/admission-source.controller';

@Module({
  controllers: [
    ReligionController,
    CasteController,
    CategoryController,
    GenderController,
    BloodGroupController,
    LanguageController,
    DisabilityController,
    RelationTypeController,
    QuotaController,
    AdmissionSourceController,
  ],
  providers: [
    ReligionService,
    CasteService,
    CategoryService,
    GenderService,
    BloodGroupService,
    LanguageService,
    DisabilityService,
    RelationTypeService,
    QuotaService,
    AdmissionSourceService,
  ],
  exports: [
    ReligionService,
    CasteService,
    CategoryService,
    GenderService,
    BloodGroupService,
    LanguageService,
    DisabilityService,
    RelationTypeService,
    QuotaService,
    AdmissionSourceService,
  ],
})
export class MastersModule {}
