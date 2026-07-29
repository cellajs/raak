import { inArray } from 'drizzle-orm';
import { getPublicProject, getPublicTask, getPublicTasks } from 'sdk';
import { generateId } from 'shared/utils/entity-id';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { baseDb as db } from '#/db/db';
import { projectsTable } from '#/modules/project/project-db';
import { tasksTable } from '#/modules/task/task-db';
import { TaskStatus } from '#/modules/task/task-properties';
import { mockStxBase } from '#/schemas/sync-transaction-mocks';
import { defaultHeaders } from './fixtures';
import { clearSecurityTestData, createTestTenant, type TestTenant } from './security/helpers';
import { createAppClient } from './test-client';
import { mockFetchRequest, setTestConfig } from './test-utils';

setTestConfig({ enabledAuthStrategies: ['passkey'] });

const publicProjectId = generateId();
const privateProjectId = generateId();
const publicTaskId = generateId();
const privateTaskId = generateId();
const publicTaskInPrivateProjectId = generateId();

// publicAt is row-local: a product is publicly readable from its OWN publicAt, independent of its
// project. A public task in a private project is readable; a private task is not.
describe('Public read routes (engine-resolved grants, anonymous actor)', async () => {
  const call = await createAppClient();
  let tenant: TestTenant;

  beforeAll(async () => {
    mockFetchRequest();
    tenant = await createTestTenant(call, 'public-read-routes');

    const baseProject = {
      tenantId: tenant.tenantId,
      organizationId: tenant.organization.id,
      createdBy: tenant.user.id,
    };
    await db.insert(projectsTable).values([
      {
        ...baseProject,
        id: publicProjectId,
        name: 'Public project',
        slug: `public-project-${publicProjectId.slice(0, 8)}`,
        publicAt: new Date().toISOString(),
      },
      {
        ...baseProject,
        id: privateProjectId,
        name: 'Private project',
        slug: `private-project-${privateProjectId.slice(0, 8)}`,
        publicAt: null,
      },
    ]);

    const publicAt = new Date().toISOString();
    const baseTask = {
      tenantId: tenant.tenantId,
      organizationId: tenant.organization.id,
      summary: '',
      primaryLabelId: crypto.randomUUID(),
      displayOrder: 1,
      status: TaskStatus.Unstarted,
      stx: mockStxBase(),
      createdBy: tenant.user.id,
    };
    await db.insert(tasksTable).values([
      { ...baseTask, id: publicTaskId, name: 'public task', projectId: publicProjectId, publicAt },
      { ...baseTask, id: privateTaskId, name: 'private task', projectId: privateProjectId, publicAt: null },
      { ...baseTask, id: publicTaskInPrivateProjectId, name: 'public task, private project', projectId: privateProjectId, publicAt },
    ]);
  });

  afterAll(async () => {
    await db.delete(tasksTable).where(inArray(tasksTable.id, [publicTaskId, privateTaskId, publicTaskInPrivateProjectId]));
    await db.delete(projectsTable).where(inArray(projectsTable.id, [publicProjectId, privateProjectId]));
    await clearSecurityTestData();
  });

  it('Q1: public project GET follows the public read grant', async () => {
    const publicResult = await call(getPublicProject, { path: { id: publicProjectId }, headers: defaultHeaders });
    expect(publicResult.response.status).toBe(200);

    const privateResult = await call(getPublicProject, { path: { id: privateProjectId }, headers: defaultHeaders });
    expect(privateResult.response.status).toBe(403);
  });

  it("Q2: public task GET follows the task's own publicAt, independent of the project", async () => {
    const publicResult = await call(getPublicTask, { path: { id: publicTaskId }, headers: defaultHeaders });
    expect(publicResult.response.status).toBe(200);

    const privateResult = await call(getPublicTask, { path: { id: privateTaskId }, headers: defaultHeaders });
    expect(privateResult.response.status).toBe(403);

    // Decoupled: a public task in a private project is readable
    const decoupledResult = await call(getPublicTask, { path: { id: publicTaskInPrivateProjectId }, headers: defaultHeaders });
    expect(decoupledResult.response.status).toBe(200);
  });

  it("Q3: public task list filters by each task's own publicAt, not the project", async () => {
    const publicList = await call(getPublicTasks, { query: { projectId: publicProjectId }, headers: defaultHeaders });
    expect(publicList.response.status).toBe(200);
    const publicItems = (publicList.data as { items: { id: string }[] } | undefined)?.items ?? [];
    expect(publicItems.map(({ id }) => id)).toEqual([publicTaskId]);

    // Private project: no project gate; returns only its own public tasks
    const privateList = await call(getPublicTasks, { query: { projectId: privateProjectId }, headers: defaultHeaders });
    expect(privateList.response.status).toBe(200);
    const privateItems = (privateList.data as { items: { id: string }[] } | undefined)?.items ?? [];
    expect(privateItems.map(({ id }) => id)).toEqual([publicTaskInPrivateProjectId]);
  });
});
