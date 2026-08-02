import { Injectable } from '@nestjs/common';
import {
  ContextResolverService,
  ResolveContextInput,
} from './services/context-resolver.service';
import { ContextDiscoveryService } from './services/context-discovery.service';
import { ContextValidatorService } from './services/context-validator.service';
import { RoleType } from '@/generated/client';

@Injectable()
export class ContextService {
  constructor(
    private readonly resolverService: ContextResolverService,
    private readonly discoveryService: ContextDiscoveryService,
    private readonly validatorService: ContextValidatorService,
  ) {}

  resolveContext(input: ResolveContextInput) {
    return this.resolverService.resolveContext(input);
  }

  discoverContexts(
    userId: string,
    role: RoleType,
    userOrgId?: string | null,
    userBranchId?: string | null,
    filterOrgId?: string | null,
    filterBranchId?: string | null,
  ) {
    return this.discoveryService.discoverContexts(
      userId,
      role,
      userOrgId,
      userBranchId,
      filterOrgId,
      filterBranchId,
    );
  }

  validateFullContext(
    organizationId: string,
    branchId: string,
    academicYearId: string,
    userId: string,
    role: RoleType,
    userOrgId?: string | null,
    userBranchId?: string | null,
  ) {
    return this.validatorService.validateFullContext(
      organizationId,
      branchId,
      academicYearId,
      userId,
      role,
      userOrgId,
      userBranchId,
    );
  }
}
