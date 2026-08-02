import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { HealthModule } from '@/modules/health/health.module';
import databaseConfig from '@/config/database.config';
import { SecurityModule } from '@/common/services/security.module';

/**
 * Boots the health module with the same URI versioning main.ts applies, so the
 * probe paths asserted here are the paths the server really serves. Getting
 * this wrong is silent: an orchestrator probing a 404 sees an unhealthy
 * instance and restarts it forever.
 */
describe('Health endpoints (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      // PrismaModule also provides SeederService, so standing it up in
      // isolation needs ConfigService and PasswordService too — both are
      // global in AppModule.
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [databaseConfig] }),
        SecurityModule,
        HealthModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves /live unversioned', async () => {
    const response = await request(app.getHttpServer()).get('/live');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(typeof response.body.uptimeSeconds).toBe('number');
  });

  it('does not serve the probes under the version prefix', async () => {
    // Probe paths must not move when the API version does.
    await expect(
      request(app.getHttpServer())
        .get('/v1/live')
        .then((r) => r.status),
    ).resolves.toBe(404);
  });

  it('reports the database on /ready', async () => {
    const response = await request(app.getHttpServer()).get('/ready');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.info.database.status).toBe('up');
  });

  it('reports database and memory on /health', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(Object.keys(response.body.info)).toEqual(
      expect.arrayContaining(['database', 'memoryHeap']),
    );
  });

  it('answers /live without touching the database', async () => {
    // Liveness must not depend on a dependency: a probe that checks the
    // database restarts every healthy instance during a database outage.
    const response = await request(app.getHttpServer()).get('/live');

    expect(response.body).not.toHaveProperty('info');
    expect(response.body).not.toHaveProperty('details');
  });
});
