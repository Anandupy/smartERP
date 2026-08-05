import { ApiProperty } from '@nestjs/swagger';
import { RoleType, UserStatus } from '@/generated/client';
import {
  AvailableAcademicYearDto,
  AvailableBranchDto,
  AvailableOrganizationDto,
} from '@/modules/context/dto/context-response.dto';
import { WorkspaceSetupStatusDto } from '@/modules/workspace/setup/dto/workspace-setup-status.dto';

/**
 * The user record as every endpoint returns it.
 *
 * Mirrors `UserService.userSelect()` — `passwordHash`, `twoFactorSecret`,
 * `failedLoginAttempts` and `lockUntil` are never selected, so they are absent
 * here too rather than documented and then withheld.
 */
export class UserProfileDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6a' })
  id!: string;

  @ApiProperty({ example: 'Asha Verma' })
  fullName!: string;

  @ApiProperty({ example: 'asha.verma' })
  username!: string;

  @ApiProperty({ example: 'asha.verma@example.edu' })
  email!: string;

  @ApiProperty({ example: '+919876543210' })
  phone!: string;

  @ApiProperty({ enum: RoleType, example: RoleType.BRANCH_ADMIN })
  role!: RoleType;

  @ApiProperty({
    nullable: true,
    example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6b',
  })
  organizationId!: string | null;

  @ApiProperty({
    nullable: true,
    example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6c',
  })
  branchId!: string | null;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status!: UserStatus;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastLoginAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

/** The tenant context `GET /auth/me` resolved for the request. */
export class AuthContextDto {
  @ApiProperty({
    nullable: true,
    example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6b',
  })
  organizationId!: string | null;

  @ApiProperty({
    nullable: true,
    example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6c',
  })
  branchId!: string | null;

  @ApiProperty({
    nullable: true,
    example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6d',
  })
  academicYearId!: string | null;
}

/**
 * The client's whole bootstrap in one response: identity, permissions, the
 * resolved context, the contexts it may switch to, and whether the workspace
 * still needs setting up.
 */
export class AuthMeDto {
  @ApiProperty({ type: UserProfileDto })
  user!: UserProfileDto;

  @ApiProperty({ enum: RoleType, example: RoleType.BRANCH_ADMIN })
  role!: RoleType;

  @ApiProperty({
    description: 'Effective permission keys after role grants and overrides.',
    type: [String],
    example: ['settings.view', 'settings.manage', 'admissions.view'],
  })
  permissions!: string[];

  @ApiProperty({ type: AuthContextDto })
  context!: AuthContextDto;

  @ApiProperty({
    description:
      'Workspace bootstrap state. When `setupRequired` is true the client must run the setup flow before tenant headers are required.',
    type: WorkspaceSetupStatusDto,
  })
  setup!: WorkspaceSetupStatusDto;

  @ApiProperty({ type: [AvailableOrganizationDto] })
  availableOrganizations!: AvailableOrganizationDto[];

  @ApiProperty({ type: [AvailableBranchDto] })
  availableBranches!: AvailableBranchDto[];

  @ApiProperty({ type: [AvailableAcademicYearDto] })
  availableAcademicYears!: AvailableAcademicYearDto[];
}

/** The token pair issued by login and refresh. */
export class AuthTokensDto {
  @ApiProperty({
    description: 'JWT bearer token. Send as `Authorization: Bearer <token>`.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…',
  })
  accessToken!: string;

  @ApiProperty({
    description:
      'Opaque refresh token, rotated on every use. Send to `POST /auth/refresh`.',
    example: 'JvR4kUq3W1nO8t2Fh6ZbA9cLmXyE0sPdTgIu5rNjQwVk…',
  })
  refreshToken!: string;
}

/**
 * An active session, derived from a live refresh token.
 *
 * The token itself is never returned — only its hash is stored, and the id is
 * what `DELETE /auth/sessions/:id` revokes.
 */
export class AuthSessionDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6e' })
  id!: string;

  @ApiProperty({ nullable: true, example: 'Desktop' })
  device!: string | null;

  @ApiProperty({ nullable: true, example: '203.0.113.42' })
  ipAddress!: string | null;

  @ApiProperty({
    nullable: true,
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  })
  userAgent!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

/**
 * The payload of the OTP and email-verification endpoints.
 *
 * Their handlers return `{ success, message }`; the interceptor lifts `message`
 * onto the envelope and leaves `success` behind as the payload — so `data` is
 * this one field, not the pair.
 */
export class VerificationResultDto {
  @ApiProperty({
    description: 'True when the code was accepted.',
    example: true,
  })
  success!: boolean;
}
