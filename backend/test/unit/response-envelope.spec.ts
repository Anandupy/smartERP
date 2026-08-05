import {
  ArgumentsHost,
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { GlobalResponseInterceptor } from '@/interceptors/global-response.interceptor';
import { GlobalExceptionFilter } from '@/filters/global-exception.filter';
import { LoggerService } from '@/common/logger/logger.service';
import { applyResponseEnvelope } from '@/common/http/swagger-envelope';

describe('response contract', () => {
  describe('GlobalResponseInterceptor', () => {
    const interceptor = new GlobalResponseInterceptor();

    const run = (returned: unknown) => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({ requestId: 'req-1' }),
        }),
      } as unknown as ExecutionContext;

      const next = { handle: () => of(returned) } as CallHandler;

      return firstValueFrom(interceptor.intercept(context, next));
    };

    it('wraps a { data, message } controller return', async () => {
      const body = await run({ data: { id: 'x' }, message: 'Created' });

      expect(body).toEqual({
        success: true,
        message: 'Created',
        data: { id: 'x' },
        meta: {},
        error: null,
        requestId: 'req-1',
        timestamp: expect.any(String),
      });
    });

    it('treats a bare object as the payload', async () => {
      const body = await run({ id: 'x' });

      expect(body.data).toEqual({ id: 'x' });
      expect(body.message).toBe('Success');
    });

    it('carries meta through', async () => {
      const body = await run({ data: [], meta: { total: 42 } });

      expect(body.meta).toEqual({ total: 42 });
    });

    it('correlates success responses with the request id', async () => {
      // Errors always carried this; successes did not, so a client could not
      // quote a request id when reporting a bad-but-successful response.
      const body = await run({ data: null });

      expect(body.requestId).toBe('req-1');
    });

    it('keeps a bare array an array', async () => {
      // Object-spreading a list turned it into {"0": …, "1": …} while an empty
      // list stayed an array, so one endpoint returned two different types
      // depending on how many rows it found.
      const body = await run([{ id: 'a' }, { id: 'b' }]);

      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toEqual([{ id: 'a' }, { id: 'b' }]);
    });

    it('keeps an empty array an array', async () => {
      const body = await run([]);

      expect(body.data).toEqual([]);
    });

    it('keeps a nested array under an explicit data key', async () => {
      const body = await run({ data: [{ id: 'a' }], message: 'Listed' });

      expect(body.data).toEqual([{ id: 'a' }]);
      expect(body.message).toBe('Listed');
    });

    it.each([
      ['a boolean', true],
      ['a false boolean', false],
      ['a string', 'ok'],
      ['a number', 123],
      ['zero', 0],
    ])('passes %s through as the payload', async (_label, value) => {
      const body = await run(value);

      expect(body.data).toBe(value);
      expect(body.message).toBe('Success');
    });

    it('turns null and undefined into a null payload', async () => {
      expect((await run(null)).data).toBeNull();
      expect((await run(undefined)).data).toBeNull();
    });

    it('leaves an already-built envelope alone', async () => {
      const envelope = {
        success: true,
        message: 'Prebuilt',
        data: [{ id: 'a' }],
        meta: { total: 1 },
        error: null,
        requestId: 'req-0',
        timestamp: '2026-08-05T00:00:00.000Z',
      };

      expect(await run(envelope)).toEqual(envelope);
    });

    it('still treats a bare object as the payload', async () => {
      const body = await run({ id: 'x', name: 'Main Campus' });

      expect(body.data).toEqual({ id: 'x', name: 'Main Campus' });
    });

    it('still returns a null payload for a message-only return', async () => {
      const body = await run({ message: 'Logged out successfully' });

      expect(body.data).toBeNull();
      expect(body.message).toBe('Logged out successfully');
    });
  });

  describe('GlobalExceptionFilter', () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));

    const logger = {
      error: jest.fn(),
      warn: jest.fn(),
    } as unknown as LoggerService;

    const filter = new GlobalExceptionFilter(logger);

    const host = () =>
      ({
        switchToHttp: () => ({
          getResponse: () => ({ status }),
          getRequest: () => ({
            requestId: 'req-1',
            url: '/v1/things',
            method: 'GET',
          }),
        }),
      }) as unknown as ArgumentsHost;

    beforeEach(() => jest.clearAllMocks());

    it('uses the same envelope shape as a success', async () => {
      filter.catch(new NotFoundException('Nope'), host());

      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({
        success: false,
        message: 'Nope',
        data: null,
        meta: {},
        error: { code: 'NotFoundException', details: null },
        requestId: 'req-1',
        timestamp: expect.any(String),
      });
    });

    it('preserves structured detail the client needs to recover', () => {
      filter.catch(
        new ConflictException({
          error: 'SETUP_REQUIRED',
          message: 'Workspace setup is incomplete.',
          setupStage: 'BRANCH',
          missingResources: ['BRANCH', 'ACADEMIC_YEAR'],
        }),
        host(),
      );

      const body = json.mock.calls[0][0];

      // Reducing these payloads to a message made SETUP_REQUIRED and
      // CONTEXT_SELECTION_REQUIRED impossible for a client to act on.
      expect(body.error.details).toEqual({
        setupStage: 'BRANCH',
        missingResources: ['BRANCH', 'ACADEMIC_YEAR'],
      });
    });

    it('prefers an explicit error code over the exception class name', () => {
      filter.catch(
        new ConflictException({
          error: 'CONTEXT_SELECTION_REQUIRED',
          message: 'Execution context must be selected.',
        }),
        host(),
      );

      expect(json.mock.calls[0][0].error.code).toBe(
        'CONTEXT_SELECTION_REQUIRED',
      );
    });

    it('falls back to the class name when no code is declared', () => {
      filter.catch(new BadRequestException('bad'), host());

      expect(json.mock.calls[0][0].error.code).toBe('BadRequestException');
    });

    it('joins class-validator message arrays', () => {
      filter.catch(
        new BadRequestException({
          message: ['name required', 'code required'],
        }),
        host(),
      );

      expect(json.mock.calls[0][0].message).toBe(
        'name required, code required',
      );
    });

    it('does not leak database internals', () => {
      filter.catch(
        new Error('unique constraint violated on users_email'),
        host(),
      );

      const body = json.mock.calls[0][0];
      expect(body.message).toBe(
        'Unable to process request due to database validation failure.',
      );
      expect(body.error.code).toBe('DATABASE_CONSTRAINT_ERROR');
    });
  });

  describe('applyResponseEnvelope', () => {
    const buildDocument = () =>
      ({
        paths: {
          '/v1/things': {
            get: {
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/ThingDto' },
                    },
                  },
                },
                '404': {
                  content: {
                    'application/json': { schema: { type: 'object' } },
                  },
                },
              },
            },
          },
        },
      }) as never;

    /** Navigates the transformed document to a response schema. */
    const schemaFor = (doc: unknown, statusCode: string): any =>
      (doc as any).paths['/v1/things'].get.responses[statusCode].content[
        'application/json'
      ].schema;

    it('nests the declared payload under data', () => {
      const schema = schemaFor(applyResponseEnvelope(buildDocument()), '200');

      expect(schema.properties.data).toEqual({
        $ref: '#/components/schemas/ThingDto',
      });
      expect(schema.properties.success).toBeDefined();
      expect(schema.properties.requestId).toBeDefined();
    });

    it('describes failures with the plain envelope', () => {
      const schema = schemaFor(applyResponseEnvelope(buildDocument()), '404');

      expect(schema).toEqual({
        $ref: '#/components/schemas/ResponseEnvelope',
      });
    });

    it('registers the envelope schemas', () => {
      const doc = applyResponseEnvelope(buildDocument());

      expect(doc.components?.schemas?.ResponseEnvelope).toBeDefined();
      expect(doc.components?.schemas?.ErrorEnvelope).toBeDefined();
    });
  });
});
