import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '@/common/decorators/public.decorator';
import { PrismaHealthIndicator } from './prisma.health';
import {
  ApiOkEnvelope,
  ApiPublicErrors,
} from '@/common/http/api-envelope-response.decorator';
import { HealthCheckResultDto, LivenessDto } from './dto/health-response.dto';

/** Heap ceiling above which the process is considered unhealthy. */
const HEAP_LIMIT_BYTES = 512 * 1024 * 1024;

/**
 * Process and dependency probes.
 *
 * Three endpoints because orchestrators ask three different questions, and
 * answering them all with one check causes outages:
 *
 * - `/live` — is the process alive? Never touches a dependency. A liveness
 *   probe that checks the database restarts every healthy instance during a
 *   database blip, turning a partial outage into a total one.
 * - `/ready` — can this instance serve traffic? Checks the database, so an
 *   instance that cannot reach it is removed from the load balancer rather
 *   than serving errors.
 * - `/health` — full report for humans and monitoring.
 *
 * All three are public and exempt from throttling: probes run continuously and
 * must not be rate limited into a false negative.
 */
@ApiTags('Health')
// Version-neutral: URI versioning is enabled with a default of v1, which would
// otherwise place these at /v1/health. Probes are infrastructure endpoints and
// must keep stable, unversioned paths — an orchestrator's probe configuration
// should not have to change when the API version does.
@Controller({ version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Get('live')
  @Public()
  @SkipThrottle()
  @ApiOperation({
    summary: 'Liveness probe',
    description:
      'Returns 200 while the process is running. Checks no dependencies, so a database outage never triggers a restart.',
  })
  @ApiOkEnvelope(LivenessDto, { message: 'Success' })
  @ApiPublicErrors()
  live(): { status: string; uptimeSeconds: number } {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  @Get('ready')
  @Public()
  @SkipThrottle()
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe',
    description:
      'Returns 200 when this instance can serve traffic. Fails while the database is unreachable.',
  })
  @ApiOkEnvelope(HealthCheckResultDto, { message: 'Success' })
  @ApiPublicErrors(503)
  ready(): Promise<HealthCheckResult> {
    return this.health.check([() => this.prisma.isHealthy('database')]);
  }

  @Get('health')
  @Public()
  @SkipThrottle()
  @HealthCheck()
  @ApiOperation({
    summary: 'Full health report',
    description: 'Dependency and resource checks, for monitoring dashboards.',
  })
  @ApiOkEnvelope(HealthCheckResultDto, { message: 'Success' })
  @ApiPublicErrors(503)
  health_(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prisma.isHealthy('database'),
      () => this.memory.checkHeap('memoryHeap', HEAP_LIMIT_BYTES),
    ]);
  }
}
