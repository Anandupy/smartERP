import { Module } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { PermissionService } from './permission.service';
import { PermissionResolverService } from './permission-resolver.service';
import { AuthorizationController } from './authorization.controller';

@Module({
  imports: [],
  controllers: [AuthorizationController],
  providers: [
    AuthorizationService,
    PermissionService,
    PermissionResolverService,
  ],
  exports: [AuthorizationService, PermissionService, PermissionResolverService],
})
export class AuthorizationModule {}
