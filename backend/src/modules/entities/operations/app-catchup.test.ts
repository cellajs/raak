import { sql } from 'drizzle-orm';
import { appConfig } from 'shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedDb } from '#/db/db';
import type { MembershipBaseModel } from '#/modules/memberships/helpers/select';
import { answerCatchupViews } from './app-catchup';

/**
 * View-driven catchup answers: authorization via resolveViewReadStatus (real app
 * config: organization → attachment), summaries from channel_counters f:/e: rollups.
 */

const ORG = 'org-catchup-test';
const OTHER_ORG = 'org-catchup-other';
const [productType] = appConfig.productEntityTypes;

const orgAdmin: MembershipBaseModel[] = [
  {
    id: 'mem-1',
    userId: 'actor',
    channelType: 'organization',
    channelId: ORG,
    organizationId: ORG,
    role: 'admin',
  } as unknown as MembershipBaseModel,
];

beforeAll(async () => {
  await seedDb.execute(
    sql.raw(`
      INSERT INTO channel_counters (channel_key, counts, updated_at)
      VALUES ('${ORG}', '{"sequence": 40, "e:f:${productType}": 37, "e:c:${productType}": 12}'::jsonb, NOW())
      ON CONFLICT (channel_key) DO UPDATE SET counts = EXCLUDED.counts
    `),
  );
});

afterAll(async () => {
  await seedDb.execute(sql.raw(`DELETE FROM channel_counters WHERE channel_key = '${ORG}'`));
});

describe('answerCatchupViews', () => {
  it('answers an authorized org view with frontier/count summaries', async () => {
    const answers = await answerCatchupViews(orgAdmin, { userId: 'actor', isSystemAdmin: false }, [
      { key: 'v1', organizationId: ORG, prefixes: [ORG], entityTypes: [productType], cursor: 30 },
    ]);

    expect(answers).toEqual([
      { key: 'v1', status: 'ok', frontiers: { [productType]: 37 }, counts: { [productType]: 12 } },
    ]);
  });

  it('answers a view outside the caller memberships without leaking numbers', async () => {
    // Raak's first product entity type (task) has publicRead('publicSelf') configured
    // (permissions-config.ts), a membership-independent grant: a non-member of OTHER_ORG can
    // never be proven to have ZERO read route (a public task might exist there), so the
    // status is 'opaque' (no numbers), not 'forbidden' (no route at all) — the un-leaking
    // intent still holds, since 'opaque' also omits frontiers/counts.
    const answers = await answerCatchupViews(orgAdmin, { userId: 'actor', isSystemAdmin: false }, [
      { key: 'v2', organizationId: OTHER_ORG, prefixes: [OTHER_ORG], entityTypes: [productType], cursor: 0 },
    ]);

    expect(answers).toEqual([{ key: 'v2', status: 'opaque' }]);
  });

  it('a mixed request answers each view independently', async () => {
    const answers = await answerCatchupViews(orgAdmin, { userId: 'actor', isSystemAdmin: false }, [
      { key: 'a', organizationId: ORG, prefixes: [ORG], entityTypes: [productType], cursor: 37 },
      { key: 'b', organizationId: OTHER_ORG, prefixes: [OTHER_ORG], entityTypes: [productType], cursor: 5 },
    ]);

    // See the previous test: task's publicRead makes 'opaque', not 'forbidden', the correct
    // outcome for a non-member org.
    expect(answers.map((a) => [a.key, a.status])).toEqual([
      ['a', 'ok'],
      ['b', 'opaque'],
    ]);
  });

  it('a forged prefix pointing at another org is forbidden even with real memberships', async () => {
    const answers = await answerCatchupViews(orgAdmin, { userId: 'actor', isSystemAdmin: false }, [
      { key: 'v3', organizationId: ORG, prefixes: [`${OTHER_ORG}/x`], entityTypes: [productType], cursor: 0 },
    ]);

    expect(answers).toEqual([{ key: 'v3', status: 'forbidden' }]);
  });

  it('returns empty for no views', async () => {
    expect(await answerCatchupViews(orgAdmin, { userId: 'actor', isSystemAdmin: false }, [])).toEqual([]);
  });
});
