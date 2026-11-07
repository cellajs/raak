import { defineScreenshotsApp, type Page, type SignedIn } from '@cellajs/cli/screenshots';
import { getMyMemberships, getOrganizations, getTasks, getWorkspaces } from '../sdk/gen/index.ts';
import { apiClient } from './a11y.ts';
import { hideDevUi } from './screenshots.ts';

const marketing = 'frontend/public/static/marketing/screenshots';

/**
 * The first published organization in the shot user's menu that they administer. The seed makes one a draft, whose
 * page opens under a "Publish" banner.
 */
const administeredOrganization = async (user: SignedIn) => {
  const client = apiClient(user);
  const [{ items: organizations }, { items: memberships }] = await Promise.all([
    getOrganizations({ client, query: { limit: 50 } }),
    getMyMemberships({ client }),
  ]);
  const published = organizations.filter(({ publishedAt }) => publishedAt);
  return (
    memberships
      .filter((membership) => membership.channelType === 'organization' && membership.role === 'admin' && !membership.archived)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((membership) => published.find(({ id }) => id === membership.channelId))
      .find(Boolean) ??
    published[0] ??
    null
  );
};

/** The workspace every board shot is taken in: the first of that organization, and the one with the most tasks to show. */
const shotWorkspace = async (user: SignedIn) => {
  const organization = await administeredOrganization(user);
  if (!organization) return null;
  const { items: workspaces } = await getWorkspaces({ client: apiClient(user), query: { organizationId: organization.id, limit: 50 } });
  const workspace = workspaces[0];
  if (!workspace) return null;
  return { id: workspace.id, organization, path: `/${organization.tenantId}/${organization.slug}/workspace/${workspace.slug}` };
};

/**
 * Brings a board or table to the state a returning user sees. Waits for the first task: `settle` gives up after five
 * seconds, and a cold dev server is still compiling the board then. Dismisses "Getting started", an empty first panel
 * for an organization without a welcome text. Through the DOM, never by role: an open task sheet takes the page behind
 * it out of the accessibility tree.
 */
const tidyBoard = async (page: Page) => {
  await page.locator('[data-task-card-id], .rdg-row').first().waitFor();
  // The dismissal lives in the per-user IndexedDB alert store, so it cannot be seeded through localStorage
  const explainer = page.locator('button', { hasText: /^Don't show again$/ });
  if (await explainer.count()) {
    await explainer.first().evaluate((button: HTMLElement) => button.click());
    await explainer.first().waitFor({ state: 'detached' });
  }
  await hideDevUi(page);
  // The shots show the team's own board; the sample's Sample mark, true of the seeded data, would tell a reader otherwise
  await page.evaluate(() => {
    for (const badge of document.querySelectorAll<HTMLElement>('[data-slot="badge"]')) {
      if (badge.textContent === 'Sample') badge.style.display = 'none';
    }
  });
  // The rail's unread counts arrive late on a seeded database, and differ between the runs of a light and dark pair
  await page.addStyleTag({ content: '[data-sidebar="menu-button"] span.rounded-full.font-bold { visibility: hidden; }' });
};

/** The board or table, then the opened task once its description has joined the relay: until then it reads "Connecting...". */
const tidyTask = async (page: Page) => {
  await tidyBoard(page);
  await page.locator('[contenteditable="true"]').first().waitFor();
};

/** The table, once its rows have their summaries: a row renders first and fills that cell a moment later. */
const tidyTable = async (page: Page) => {
  await tidyBoard(page);
  await page.locator('.rdg-row [role="gridcell"] button', { hasText: /\S/ }).first().waitFor();
};

/** raak ships its own boards in the carousel, and none of the template's organization and docs shots. */
export default defineScreenshotsApp({
  devices: {
    // 1.5, not 2: a card's gradient and the blur behind a task sheet do not compress lossless, and 1920px is still more
    // than the About page's mockup draws on a retina screen (54vw, 85% of it the screen).
    pc: { width: 1280, height: 720, scale: 1.5 }, // aspect-video
  },

  placeholders: {
    workspace: async (user) => (await shotWorkspace(user))?.path ?? null,
    /** A task of that workspace, opened in its sheet: the newest with todos, which shows more of what a task holds. */
    task: async (user) => {
      const workspace = await shotWorkspace(user);
      if (!workspace) return null;
      const { tenantId, id: organizationId } = workspace.organization;
      const { items } = await getTasks({
        client: apiClient(user),
        path: { tenantId, organizationId },
        query: { workspaceId: workspace.id, sort: 'createdAt', order: 'desc', limit: 20 },
      });
      const tasks = items.filter((item) => 'checkboxCount' in item);
      return (tasks.find(({ checkboxCount }) => checkboxCount > 0) ?? tasks[0])?.id ?? null;
    },
  },

  remove: ['system-page', 'org-page', 'settings', 'docs-operations', 'hero-menu', 'hero-page', 'readme'],

  add: [
    // The three images the marketing carousel shows (`marketing-config.tsx`), in its order
    { id: 'board', device: 'pc', path: '{workspace}', out: `${marketing}/board`, open: tidyBoard },
    { id: 'table', device: 'pc', path: '{workspace}?view=table', out: `${marketing}/table`, open: tidyTable },
    // The sheet over the board it was opened from, which is what a reader of the carousel sees when they click a card
    { id: 'task', device: 'pc', path: '{workspace}?taskSheetId={task}', out: `${marketing}/task`, open: tidyTask },
    // raak on a phone, for the showcase on cella's About page. raak ships neither: they land in the gitignored `.temp`,
    // and are copied from there to `frontend/public/static/marketing/showcases/` in the cella checkout.
    { id: 'showcase-board', device: 'mobile', path: '{workspace}', out: '.temp/showcases/raak-1', open: tidyBoard },
    { id: 'showcase-task', device: 'mobile', path: '{workspace}?taskSheetId={task}', out: '.temp/showcases/raak-2', open: tidyTask },
  ],
});
