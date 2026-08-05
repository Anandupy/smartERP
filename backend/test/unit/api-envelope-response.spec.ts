import { ApiProperty } from '@nestjs/swagger';
import {
  ApiEmptyEnvelope,
  ApiOkEnvelope,
  ApiPaginatedEnvelope,
  ApiPaginatedItemsEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import { ENVELOPE_MARKER } from '@/common/http/envelope-schema';
import { applyResponseEnvelope } from '@/common/http/swagger-envelope';

class ThingDto {
  @ApiProperty()
  id!: string;
}

/** Applies a method decorator and returns the Swagger response metadata. */
const responsesOf = (
  decorate: MethodDecorator & ClassDecorator,
): Record<string, any> => {
  class Controller {
    handle(): void {}
  }

  const descriptor = Object.getOwnPropertyDescriptor(
    Controller.prototype,
    'handle',
  )!;

  decorate(Controller.prototype, 'handle', descriptor);

  return Reflect.getMetadata(
    'swagger/apiResponse',
    descriptor.value,
  ) as Record<string, any>;
};

describe('ApiEnvelopeResponse decorators', () => {
  it('nests the DTO under data inside the envelope', () => {
    const schema = responsesOf(ApiOkEnvelope(ThingDto))['200'].schema;

    expect(schema.properties.data).toEqual({
      $ref: '#/components/schemas/ThingDto',
    });
    expect(Object.keys(schema.properties)).toEqual(
      expect.arrayContaining([
        'success',
        'message',
        'data',
        'meta',
        'error',
        'requestId',
        'timestamp',
      ]),
    );
    expect(schema.required).toEqual([
      'success',
      'message',
      'data',
      'meta',
      'error',
      'requestId',
      'timestamp',
    ]);
  });

  it('documents arrays as an array of the DTO', () => {
    const schema = responsesOf(ApiOkEnvelope(ThingDto, { isArray: true }))['200']
      .schema;

    expect(schema.properties.data).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/ThingDto' },
    });
  });

  it('documents an empty response as data: null, not unknown', () => {
    const schema = responsesOf(ApiEmptyEnvelope())['200'].schema;

    expect(schema.properties.data).toMatchObject({
      nullable: true,
      example: null,
    });
    expect(schema.properties.data.type).toBeUndefined();
  });

  it('types meta when pagination rides on the envelope', () => {
    const schema = responsesOf(ApiPaginatedEnvelope(ThingDto))['200'].schema;

    expect(schema.properties.meta).toEqual({
      $ref: '#/components/schemas/PaginationMetaDto',
    });
    expect(schema.properties.data).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/ThingDto' },
    });
  });

  it('documents pagination inside data when that is where it lands', () => {
    // Controllers that return `{ data: serviceResult }` keep `{ items, meta }`
    // under `data`; the envelope's own `meta` stays empty.
    const schema = responsesOf(ApiPaginatedItemsEnvelope(ThingDto))['200']
      .schema;

    expect(schema.properties.data.properties.items).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/ThingDto' },
    });
    expect(schema.properties.data.properties.meta).toEqual({
      $ref: '#/components/schemas/PaginationMetaDto',
    });
    expect(schema.properties.meta).toMatchObject({ type: 'object' });
  });

  it('documents failures with the shared envelope', () => {
    const responses = responsesOf(ApiStandardErrors(404, 409));

    expect(Object.keys(responses).sort()).toEqual([
      '400',
      '401',
      '403',
      '404',
      '409',
      '500',
    ]);

    for (const response of Object.values(responses)) {
      expect(response.schema).toEqual({
        $ref: '#/components/schemas/ResponseEnvelope',
      });
    }
  });

  it('leaves a decorated response alone when the document is transformed', () => {
    // Both mechanisms are live at once; a decorated handler must not get a
    // second envelope wrapped around the first.
    const declared = responsesOf(ApiOkEnvelope(ThingDto))['200'].schema;

    const document = {
      paths: {
        '/v1/things': {
          get: {
            responses: {
              '200': {
                content: { 'application/json': { schema: declared } },
              },
            },
          },
        },
      },
    } as never;

    const schema = (applyResponseEnvelope(document) as any).paths['/v1/things']
      .get.responses['200'].content['application/json'].schema;

    expect(schema[ENVELOPE_MARKER]).toBe(true);
    expect(schema.properties.data).toEqual({
      $ref: '#/components/schemas/ThingDto',
    });
    expect(schema.properties.data.properties).toBeUndefined();
  });
});
