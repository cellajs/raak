import { appConfig } from 'shared';
import { describe, expect, it } from 'vitest';
import { labelUsedCountKey } from '#/modules/label/label-queries';

describe('labelUsedCountKey', () => {
  it('reads the e:c:<hostProduct> key that CDC writes for label references', () => {
    const embedding = appConfig.productEmbeddings.find((e) => e.embeddedProduct === 'label');
    expect(embedding).toBeDefined();
    // CDC emits `e:c:${embedding.hostProduct}` per embedded id (cdc getCountDeltas);
    // the literal locks the wire contract for the default config.
    expect(labelUsedCountKey).toBe(`e:c:${embedding?.hostProduct}`);
    expect(labelUsedCountKey).toBe('e:c:task');
  });
});
