import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ConflictException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_DURING_SETUP_KEY } from '../decorators/allow-during-setup.decorator';
import { WorkspaceSetupService } from '@/modules/workspace/setup/workspace-setup.service';
import { AuthenticatedRequest } from '../logger/request-context.middleware';

/**
 * Blocks the ordinary API surface until the workspace has been bootstrapped.
 *
 * Runs immediately after authentication and before context resolution, so that
 * a fresh installation answers with an actionable `SETUP_REQUIRED` payload
 * rather than the misleading "No active organization available for user."
 * that context resolution would otherwise raise on every endpoint.
 */
@Injectable()
export class WorkspaceSetupGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly setupService: WorkspaceSetupService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Unauthenticated requests are already rejected by JwtAuthGuard; there is
    // nothing useful to tell a caller that has no session.
    if (!request.user) {
      return true;
    }

    if (await this.setupService.isInitialized()) {
      return true;
    }

    const allowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_DURING_SETUP_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (allowed) {
      return true;
    }

    const status = await this.setupService.getStatus();

    throw new ConflictException({
      error: 'SETUP_REQUIRED',
      message:
        'Workspace setup is incomplete. Complete the setup flow before using this endpoint.',
      setupRequired: status.setupRequired,
      setupStage: status.setupStage,
      missingResources: status.missingResources,
      allowedActions: status.allowedActions,
    });
  }
}
