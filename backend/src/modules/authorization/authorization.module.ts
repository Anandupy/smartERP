import { Module } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { PermissionCatalogService } from './permission-catalog.service';
import { PermissionAssignmentService } from './permission-assignment.service';
import { PermissionResolverService } from './permission-resolver.service';
import { AuthorizationController } from './authorization.controller';

@Module({
  imports: [],
  controllers: [AuthorizationController],
  providers: [
    AuthorizationService,
    PermissionCatalogService,
    PermissionAssignmentService,
    PermissionResolverService,
  ],
  exports: [
    AuthorizationService,
    PermissionCatalogService,
    PermissionAssignmentService,
    PermissionResolverService,
  ],
})
export class AuthorizationModule {}
