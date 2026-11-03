import '~/query/tests/query-client-env';
import { appConfig } from 'shared';
import { describe, expect, it, vi } from 'vitest';
import type { UserMenuItem } from '~/modules/me/types';
import { buildMenu } from '~/modules/navigation/menu-sheet/helpers/build-menu';
import {
  activeUnseenChannelIds,
  menuUnseenChannelIds,
  organizationUnseenChannelIds,
} from '~/modules/navigation/menu-sheet/helpers/use-menu-item-unseen-count';

vi.mock('~/lib/entity-modules', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/lib/entity-modules')>()),
  // A section lists only what its module declares; these tests register no modules
  getMenuSection: (entityType: string) => (entityType === 'workspace' ? { entityType, label: 'c:workspace_other' } : undefined),
}));

const row = (entityType: UserMenuItem['entityType'], id: string, membership: Record<string, unknown> = {}) =>
  // Only the fields the rollup reads; a whole enriched row adds nothing to what these tests prove
  ({
    id,
    entityType,
    membership: { organizationId: 'org', archived: false, muted: false, displayOrder: 1, ...membership },
  }) as unknown as UserMenuItem;

const organization = row('organization', 'org');

const projects = [
  row('project', 'active-project', { workspaceId: 'active-workspace' }),
  row('project', 'muted-project', { workspaceId: 'active-workspace', muted: true }),
  row('project', 'archived-project', { workspaceId: 'active-workspace', archived: true }),
];

const workspaces = [row('workspace', 'active-workspace')];

const menu = buildMenu(
  new Map([
    ['organization', [organization]],
    ['workspace', workspaces],
    ['project', projects],
  ]),
  appConfig.menuStructure,
);

describe('unseen counts in a menu that files projects under workspaces', () => {
  it('leave archived and muted projects out of the organization', () => {
    expect(organizationUnseenChannelIds(organization, menu)).toEqual(['active-project']);
  });

  it('leave them out of the workspace row', () => {
    expect(activeUnseenChannelIds(menu.workspace)).toEqual(['active-project']);
  });

  it('count an archived project only on its own row, the one its toggle sums', () => {
    const archivedProject = menu.workspace[0].submenu?.find((item) => item.membership.archived);
    expect(archivedProject && menuUnseenChannelIds(archivedProject, false)).toEqual(['archived-project']);
  });
});
