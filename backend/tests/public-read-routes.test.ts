/**
 * End-to-end proof of consolidated public read grants.
 *
 * Public routes no longer hand-check `row.publicAt` — they ask the permission engine
 * with an anonymous actor (no memberships), and the engine resolves the declared
 * grants: `publicRead('publicSelf')` on project, `publicRead('publicParent')` on task.
 *
 * - Q1: public project GET — 200 when publicAt set, 403 when not
 * - Q2: public task GET — follows the PARENT project's publicAt (publicParent)
 * - Q3: public task list — same rule, whole list gated by the parent project
 *
 * Requires: PostgreSQL (core mode or higher)
 */

import { inArray } from 'drizzle-orm';
import { getPublicProject, getPublicTask, getPublicTasks } from 'sdk';
import { generateId } from 'shared/entity-id';
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
const taskInPublicProject = generateId();
const taskInPrivateProject = generateId();

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

    const baseTask = {
      tenantId: tenant.tenantId,
      organizationId: tenant.organization.id,
      summary: '',
      variant: 1,
      displayOrder: 1,
      status: TaskStatus.Unstarted,
      stx: mockStxBase(),
      createdBy: tenant.user.id,
    };
    await db.insert(tasksTable).values([
      { ...baseTask, id: taskInPublicProject, name: 'task in public project', projectId: publicProjectId },
      { ...baseTask, id: taskInPrivateProject, name: 'task in private project', projectId: privateProjectId },
    ]);
  });

  afterAll(async () => {
    await db.delete(tasksTable).where(inArray(tasksTable.id, [taskInPublicProject, taskInPrivateProject]));
    await db.delete(projectsTable).where(inArray(projectsTable.id, [publicProjectId, privateProjectId]));
    await clearSecurityTestData();
  });

  it('Q1: public project GET follows the publicSelf grant', async () => {
    const publicResult = await call(getPublicProject, {
      path: { id: publicProjectId },
      headers: defaultHeaders,
    });
    expect(publicResult.response.status).toBe(200);

    const privateResult = await call(getPublicProject, {
      path: { id: privateProjectId },
      headers: defaultHeaders,
    });
    expect(privateResult.response.status).toBe(403);
  });

  it('Q2: public task GET follows the PARENT project publicAt (publicParent)', async () => {
    const publicResult = await call(getPublicTask, {
      path: { id: taskInPublicProject },
      headers: defaultHeaders,
    });
    expect(publicResult.response.status).toBe(200);

    const privateResult = await call(getPublicTask, {
      path: { id: taskInPrivateProject },
      headers: defaultHeaders,
    });
    expect(privateResult.response.status).toBe(403);
  });

  it('Q3: public task list is gated by the parent project', async () => {
    const publicResult = await call(getPublicTasks, {
      query: { projectId: publicProjectId },
      headers: defaultHeaders,
    });
    expect(publicResult.response.status).toBe(200);
    const data = publicResult.data as { items: { id: string }[] } | undefined;
    expect((data?.items ?? []).map(({ id }) => id)).toEqual([taskInPublicProject]);

    const privateResult = await call(getPublicTasks, {
      query: { projectId: privateProjectId },
      headers: defaultHeaders,
    });
    expect(privateResult.response.status).toBe(403);
  });
});
