import { eq } from 'drizzle-orm';
import { generateId } from 'shared/utils/entity-id';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDb as db } from '#/db/db';
import { projectsTable } from '#/modules/project/project-db';
import { tasksTable } from '#/modules/task/task-db';
import { TaskStatus } from '#/modules/task/task-properties';
import { usersTable } from '#/modules/user/user-db';
import { mockStxBase } from '#/schemas/sync-transaction-mocks';
import { defaultHeaders } from './fixtures';
import { clearSecurityTestData, createTestTenant, type TestTenant } from './security/helpers';
import { createAppClient } from './test-client';
import { setTestConfig } from './test-utils';

setTestConfig({ enabledAuthStrategies: ['passkey'] });

// The real cover loads a remote logo and draws on a native canvas; the route's own work is what it passes on.
const cover = vi.hoisted(() => ({ calls: [] as { title: string; avatarUrl: string; name: string }[] }));
vi.mock('#/modules/task/helpers/canvas', () => ({
  generateCover: async (options: { title: string; avatarUrl: string; name: string }) => {
    cover.calls.push(options);
    return new Uint8Array([137, 80, 78, 71]);
  },
}));

const paragraph = (text: string) => ({ id: generateId(), type: 'paragraph', props: {}, content: [{ type: 'text', text, styles: {} }], children: [] });

// Previews of a task link are meant to work for a private task: these tests hold that in place.
describe('Task link previews of a private task', async () => {
  const call = await createAppClient();
  const { baseApp } = await import('#/routes');
  const anonymous = (path: string) => baseApp.request(path, { headers: defaultHeaders });

  let tenant: TestTenant;
  let authorName: string;
  const projectId = generateId();
  const taskId = generateId();
  const project = { name: 'Private roadmap', slug: `private-roadmap-${projectId.slice(0, 8)}` };

  beforeAll(async () => {
    tenant = await createTestTenant(call, 'task-link-previews');
    const [author] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, tenant.user.id));
    authorName = author.name;

    await db.insert(projectsTable).values({
      id: projectId,
      tenantId: tenant.tenantId,
      organizationId: tenant.organization.id,
      ...project,
      publicAt: null,
      createdBy: tenant.user.id,
    });
    await db.insert(tasksTable).values({
      id: taskId,
      tenantId: tenant.tenantId,
      organizationId: tenant.organization.id,
      projectId,
      name: 'Ship the private thing',
      summary: JSON.stringify([paragraph('Ship the private thing')]),
      description: JSON.stringify([paragraph('Ship the private thing'), paragraph('Only members should open this.')]),
      primaryLabelId: crypto.randomUUID(),
      displayOrder: 1,
      status: TaskStatus.Unstarted,
      publicAt: null,
      stx: mockStxBase(),
      createdBy: tenant.user.id,
    });
  });

  afterAll(async () => await clearSecurityTestData());

  it('unfurls with the type, project, author and the start of the description', async () => {
    const response = await anonymous(`/t/${taskId}`);
    const page = await response.text();

    expect(response.status).toBe(200);
    expect(page).toContain(`<title>Task in ${project.name}`);
    expect(page).toContain(`by ${authorName}</title>`);
    expect(page).toContain('<meta property="og:description" content="Ship the private thing Only members should open this." />');
    expect(page).toContain(`/t/${taskId}`);
  });

  it('draws a cover from the title and the author', async () => {
    cover.calls.length = 0;

    const response = await anonymous(`/t/${taskId}/cover`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(cover.calls).toEqual([expect.objectContaining({ title: 'Ship the private thing', name: authorName })]);
  });

  it('resolves where the link leads, and says the project is not public', async () => {
    const response = await anonymous(`/t/${taskId}/resolve`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      taskId,
      projectId,
      projectSlug: project.slug,
      organizationId: tenant.organization.id,
      organizationSlug: tenant.organization.slug,
      tenantId: tenant.tenantId,
      publicAt: null,
    });
  });

  it('answers 404 for a task that does not exist', async () => {
    const response = await anonymous(`/t/${generateId()}/resolve`);

    expect(response.status).toBe(404);
  });
});
