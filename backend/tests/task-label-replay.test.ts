import { nanoid } from 'nanoid';
import { createLabels, createProjects, createTasks, createWorkspaces } from 'sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TaskStatus } from '#/modules/task/task-properties';
import { mockStxBase } from '#/schemas/sync-transaction-mocks';
import { adminRole, defaultHeaders } from './fixtures';
import { createTestOrganization } from './helpers';
import { clearSecurityTestData, createOrgUser } from './security/helpers';
import { createAppClient } from './test-client';
import { setTestConfig } from './test-utils';

setTestConfig({ enabledAuthStrategies: ['passkey'] });

type Created = { data: { id: string; primaryLabel?: { id: string } | null }[] };

// The suite runs without the CDC worker, so only the lookup by row id can recognise a replay.
describe('Replayed task and label creates', async () => {
  const call = await createAppClient();
  let path: { tenantId: string; organizationId: string };
  let headers: Record<string, string>;
  let projectId: string;

  beforeAll(async () => {
    const org = await createTestOrganization();
    const user = await createOrgUser(call, org.tenantId, org.id, `admin-${nanoid(8)}`, adminRole);
    path = { tenantId: org.tenantId, organizationId: org.id };
    headers = { ...defaultHeaders, Cookie: user.sessionCookie };
    const firstId = (result: { data?: unknown }) => String((result.data as Created | undefined)?.data[0].id);
    const workspaceId = firstId(await call(createWorkspaces, { path, body: [{ id: `temp-${nanoid()}`, name: 'Home' }], headers }));
    projectId = firstId(
      await call(createProjects, {
        path,
        query: { workspaceId },
        body: [{ id: `temp-${nanoid()}`, name: 'Replays', slug: `replays-${crypto.randomUUID().slice(0, 8)}`, publicAt: null }],
        headers,
      }),
    );
  });

  afterAll(async () => await clearSecurityTestData());

  const taskBody = (id: string) => ({ id, name: 'Replayed', description: null, projectId, status: TaskStatus.Unstarted, stx: mockStxBase() });
  const labelBody = (id: string) => ({ id, name: `label-${id.slice(0, 8)}`, color: null, projectId, stx: mockStxBase() });

  const sendTasks = async (body: ReturnType<typeof taskBody>[]) => {
    const { data, response } = await call(createTasks, { path, body, headers });
    return { status: response.status, data: (data as Created | undefined)?.data ?? [] };
  };
  const sendLabels = async (body: ReturnType<typeof labelBody>[]) => {
    const { data, response } = await call(createLabels, { path, body, headers });
    return { status: response.status, data: (data as Created | undefined)?.data ?? [] };
  };

  it('answers a replayed task create with its hydrated row', async () => {
    const body = [taskBody(crypto.randomUUID())];
    expect((await sendTasks(body)).status).toBe(201);

    const { status, data } = await sendTasks(body);
    expect(status).toBe(200);
    expect(data.map((row) => row.id)).toEqual([body[0].id]);
    expect(data[0].primaryLabel?.id).toBeTruthy();
  });

  it('creates only the new tasks of a batch that repeats one', async () => {
    const first = taskBody(crypto.randomUUID());
    expect((await sendTasks([first])).status).toBe(201);

    const second = taskBody(crypto.randomUUID());
    const { status, data } = await sendTasks([first, second]);
    expect(status).toBe(201);
    expect(data.map((row) => row.id).sort()).toEqual([first.id, second.id].sort());
  });

  it('answers two attempts of one task create sent at the same time with its row', async () => {
    const body = [taskBody(crypto.randomUUID())];
    const answers = await Promise.all([sendTasks(body), sendTasks(body)]);
    for (const { data } of answers) expect(data.map((row) => row.id)).toEqual([body[0].id]);
  });

  it('answers a replayed label create with its row and creates the new ones beside it', async () => {
    const first = labelBody(crypto.randomUUID());
    expect((await sendLabels([first])).status).toBe(201);

    const replay = await sendLabels([first]);
    expect(replay.status).toBe(200);
    expect(replay.data.map((row) => row.id)).toEqual([first.id]);

    const second = labelBody(crypto.randomUUID());
    const batch = await sendLabels([first, second]);
    expect(batch.status).toBe(201);
    expect(batch.data.map((row) => row.id).sort()).toEqual([first.id, second.id].sort());
  });
});
