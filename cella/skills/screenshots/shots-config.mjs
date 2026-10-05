// The screenshots this app ships, for `shot-driver.mjs`. This file belongs to the app: list your own pages and states
// here, and a sync never overwrites it (it is pinned in cella/cella.config.ts). The driver and SKILL.md stay upstream.

/**
 * Viewport and scale per device. The ratios are the frames in `frontend/src/modules/marketing/device-mockup-frame.tsx`,
 * and the carousel renders a slide `object-contain`, so a shot that misses its ratio is letterboxed inside the mockup.
 * Scale 2 is a retina shot: a 1280px-wide app, drawn at 2560px.
 */
export const devices = {
  // 1600 wide because the menu sheet only pushes the content beside it from 2xl up (`isDesktop` in app-nav.tsx), and
  // overlaps the table below that. 1.5x is still more pixels than the mockup's ~735 CSS px ever draws.
  pc: { width: 1600, height: 900, scale: 1.5 }, // aspect-video
  tablet: { width: 768, height: 1024, scale: 2 }, // aspect-3/4
  mobile: { width: 375, height: 667, scale: 2 }, // aspect-9/16
};

/**
 * Values for the `{name}` placeholders in the paths below, read from the API as the shot user before the first visit.
 * `call` is a signed-in fetch of the app's own API, the same helper shape `a11y/scope-config.ts` resolvers get.
 */

/** The organization the shot user administers, the first in their menu: the one their menu opens on. */
const administeredOrganization = async (call) => {
  const [{ items: organizations }, { items: memberships }] = await Promise.all([call('/organizations?limit=50'), call('/me/memberships')]);
  const [administered] = memberships
    .filter((membership) => membership.channelType === 'organization' && membership.role === 'admin' && !membership.archived)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  return organizations.find(({ id }) => id === administered?.channelId) ?? organizations[0] ?? null;
};

/** The workspace every board shot is taken in: the first of that organization, and the one with the most tasks to show. */
const shotWorkspace = async (call) => {
  const organization = await administeredOrganization(call);
  if (!organization) return null;
  const { items: workspaces } = await call(`/workspaces?organizationId=${organization.id}&limit=50`);
  const workspace = workspaces[0];
  return workspace ? { ...workspace, path: `/${organization.tenantId}/${organization.slug}/workspace/${workspace.slug}` } : null;
};

export const placeholders = {
  /** Path of the workspace board: the shot of raak that shows its own work, project panels side by side. */
  workspace: async (call) => (await shotWorkspace(call))?.path ?? null,
  /** A task of that workspace, opened in its sheet. Newest first, so a seeded run picks a task with a description. */
  task: async (call) => {
    const workspace = await shotWorkspace(call);
    if (!workspace) return null;
    const { items: tasks } = await call(`/tasks?workspaceId=${workspace.id}&sort=createdAt&order=desc&limit=1`);
    return tasks[0]?.id ?? null;
  },
};

/** One-time UI that would otherwise land in a shot of a public page: the dev banner and the first-visit menu hint. */
export const suppress = {
  alerts: ['test-credentials'],
  hints: ['floating-menu-marketing', 'floating-menu-docs'],
};

/**
 * Every entry writes `<out>.png` and `<out>-dark.png`. `path` is a route, with `{name}` filled from the placeholders
 * above. `open` brings the page into the state the shot wants, after the route has rendered and settled.
 *
 * The three images the marketing carousel shows (`marketing-config.tsx`), in its order.
 */
export const shots = [
  {
    id: 'board',
    device: 'pc',
    path: '{workspace}',
    out: 'frontend/public/static/marketing/screenshots/board',
  },
  {
    id: 'table',
    device: 'pc',
    path: '{workspace}?view=table',
    out: 'frontend/public/static/marketing/screenshots/table',
  },
  {
    id: 'task',
    device: 'pc',
    // The sheet over the board it was opened from, which is what a reader of the carousel sees when they click a card.
    path: '{workspace}?taskSheetId={task}',
    out: 'frontend/public/static/marketing/screenshots/task',
  },
];
