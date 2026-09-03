import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { describe, expect, it } from 'vitest';
import { setupConfigSchema } from '#/schemas/app-schemas';

describe('setup config OpenAPI composition', () => {
  it('uses nullable type arrays for inline primary label fields', () => {
    const registry = new OpenAPIRegistry();
    registry.register('SetupConfig', setupConfigSchema);
    const schemas = new OpenApiGeneratorV31(registry.definitions).generateComponents().components?.schemas ?? {};

    expect(schemas).toMatchObject({
      SetupConfig: {
        properties: {
          primaryLabels: {
            items: {
              properties: {
                icon: { type: ['string', 'null'] },
              },
            },
          },
        },
      },
    });
  });
});
