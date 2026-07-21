import { SetMetadata } from '@nestjs/common';

export const REQUIRE_BRANCH_KEY = 'requireBranch';

export interface BranchOptions {
  /**
   * If true, missing Branch header will not throw an error if branch cannot be resolved.
   */
  optional?: boolean;
}

export const RequireBranch = (options: BranchOptions = {}) =>
  SetMetadata(REQUIRE_BRANCH_KEY, { optional: false, ...options });
