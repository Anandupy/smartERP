import { Module } from '@nestjs/common';
import { AuthorizationModule } from '@/modules/authorization/authorization.module';

import { NavigationPublicController } from './controllers/navigation-public.controller';
import { NavigationAdminModuleController } from './controllers/navigation-admin-module.controller';
import { NavigationAdminMenuController } from './controllers/navigation-admin-menu.controller';

import { NavigationService } from './services/navigation.service';
import { ModuleAdminService } from './services/module-admin.service';
import { MenuAdminService } from './services/menu-admin.service';
import { NavigationCacheService } from './services/navigation-cache.service';

import { NavigationTreeBuilder } from './builders/navigation-tree.builder';
import { MenuHierarchyValidator } from './validators/menu-hierarchy.validator';

import { INAVIGATION_CACHE } from './cache/navigation-cache.interface';
import { MemoryNavigationCacheService } from './cache/memory-navigation-cache.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [
    NavigationPublicController,
    NavigationAdminModuleController,
    NavigationAdminMenuController,
  ],
  providers: [
    NavigationService,
    ModuleAdminService,
    MenuAdminService,
    NavigationCacheService,
    NavigationTreeBuilder,
    MenuHierarchyValidator,
    {
      provide: INAVIGATION_CACHE,
      useClass: MemoryNavigationCacheService,
    },
  ],
  exports: [NavigationService, ModuleAdminService, MenuAdminService],
})
export class NavigationModule {}
