// The screenshots this app ships, for `shot-driver.mjs`. This file belongs to the app: list your own pages and states
// here, and a sync never overwrites it (it is pinned in cella/cella.config.ts). The driver and SKILL.md stay upstream.

/**
 * The file type of every shot: 'webp' or 'png'. WebP is written lossless by the `cwebp` encoder (`brew install webp`),
 * at under a third of the PNG's weight. The slides in `marketing-config.tsx` name the files by extension, and so does
 * cella's own `marketing-config.tsx` for the two phone shots, so a change here is a change in both.
 */
export const format = 'webp';

/**
 * Viewport and scale per device. The ratios are the frames in `frontend/src/modules/marketing/device-mockup-frame.tsx`,
 * and the carousel renders a slide `object-contain`, so a shot that misses its ratio is letterboxed inside the mockup.
 * Scale 2 is a retina shot: a 375px-wide app, drawn at 750px. The mockup draws a slide far smaller than the app, so
 * the narrowest viewport that holds the page keeps its text readable.
 */
export const devices = {
  // 1.5, not 2: a card's gradient and the blur behind a task sheet do not compress lossless, and 1920px is still more
  // than the About page's mockup draws on a retina screen (54vw, 85% of it the screen).
  pc: { width: 1280, height: 720, scale: 1.5 }, // aspect-video
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
  if (!workspace) return null;
  return {
    ...workspace,
    path: `/${organization.tenantId}/${organization.slug}/workspace/${workspace.slug}`,
    api: `/${organization.tenantId}/${organization.id}`,
  };
};

export const placeholders = {
  /** Path of the workspace board: the shot of raak that shows its own work, project panels side by side. */
  workspace: async (call) => (await shotWorkspace(call))?.path ?? null,
  /** A task of that workspace, opened in its sheet. Newest first, so a seeded run picks a task with a description. */
  task: async (call) => {
    const workspace = await shotWorkspace(call);
    if (!workspace) return null;
    const { items: tasks } = await call(`${workspace.api}/tasks?workspaceId=${workspace.id}&sort=createdAt&order=desc&limit=1`);
    return tasks[0]?.id ?? null;
  },
};

/** One-time UI that would otherwise land in a shot of a public page: the dev banner and the first-visit menu hint. */
export const suppress = {
  alerts: ['test-credentials'],
  hints: ['floating-menu-marketing', 'floating-menu-docs'],
};

/**
 * Brings a board or table to the state a returning user sees. Waits for the first task: `settle` gives up after five
 * seconds, and a cold dev server is still compiling the board then. Dismisses "Getting started", an empty first panel
 * for an organization without a welcome text, and hides the debug button a development build adds to the sidebar.
 * Both through the DOM, never by role: an open task sheet takes the page behind it out of the accessibility tree.
 */
const tidyBoard = async (page) => {
  await page.locator('[data-task-card-id], .rdg-row').first().waitFor();
  // The dismissal lives in the per-user IndexedDB alert store, so it cannot be seeded through localStorage
  const explainer = page.locator('button', { hasText: /^Don't show again$/ });
  if (await explainer.count()) {
    await explainer.first().evaluate((button) => button.click());
    await explainer.first().waitFor({ state: 'detached' });
  }
  await page.locator('button[aria-label="toggle debug toolbar"]').evaluateAll((buttons) => {
    for (const button of buttons) button.style.visibility = 'hidden';
  });
};

/**
 * Every entry writes `<out>.<format>` and `<out>-dark.<format>`. `path` is a route, with `{name}` filled from the
 * placeholders above. `open` brings the page into the state the shot wants, after the route has rendered and settled.
 */
export const shots = [
  // The three images the marketing carousel shows (`marketing-config.tsx`), in its order.
  {
    id: 'board',
    device: 'pc',
    path: '{workspace}',
    out: 'frontend/public/static/marketing/screenshots/board',
    open: tidyBoard,
  },
  {
    id: 'table',
    device: 'pc',
    path: '{workspace}?view=table',
    out: 'frontend/public/static/marketing/screenshots/table',
    open: tidyBoard,
  },
  {
    id: 'task',
    device: 'pc',
    // The sheet over the board it was opened from, which is what a reader of the carousel sees when they click a card.
    path: '{workspace}?taskSheetId={task}',
    out: 'frontend/public/static/marketing/screenshots/task',
    open: tidyBoard,
  },
  // raak on a phone, for the showcase on cella's About page. raak ships neither: they land in the gitignored `.temp`,
  // and are copied from there to `frontend/public/static/marketing/showcases/` in the cella checkout.
  {
    id: 'showcase-board',
    device: 'mobile',
    path: '{workspace}',
    out: '.temp/showcases/raak-1',
    open: tidyBoard,
  },
  {
    id: 'showcase-task',
    device: 'mobile',
    path: '{workspace}?taskSheetId={task}',
    out: '.temp/showcases/raak-2',
    open: tidyBoard,
  },
];
