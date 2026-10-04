import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createProjects, createWorkspaces, handleMcp } from 'sdk';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { resourceUri } from '#/modules/oauth-server/resources';
import { tasksTable } from '#/modules/task/task-db';
import { TaskStatus } from '#/modules/task/task-properties';
import { adminRole, defaultHeaders } from './fixtures';
import { adminDb, createTestOrganization } from './helpers';
import {
  authorizationCodeToken,
  bearerHeaders,
  clientCredentialsToken,
  installApp,
  registerApp,
  serviceAccountWithKey,
  startTestOauthServer,
  type TestOauthServer,
} from './oauth-helpers';
import { clearSecurityTestData, createOrgUser } from './security/helpers';
import { createAppClient } from './test-client';

type Rpc = { jsonrpc: '2.0'; id: number | null; result?: Record<string, unknown>; error?: { code: number; message: string; data?: unknown } };
type ToolResult = { content: { type: string; text: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean };

vi.mock('#/middlewares/rate-limiter/core', () => ({
  rateLimiter: (mode: string, key: string) =>
    Object.assign(async (_ctx: unknown, next: () => Promise<void>) => await next(), { keyPrefix: `${key}_${mode}`, buckets: [] }),
}));

const REDIRECT_URI = 'http://localhost:9999/callback';
const CLIENT_ID = 'test-task-assistant';

// The task tools run the task routes with the caller's access token, so those routes must accept one.
describe('Task tools over MCP', async () => {
  const call = await createAppClient();
  let as: TestOauthServer;
  let rpcId = 0;

  beforeAll(async () => {
    as = await startTestOauthServer();
  });
  afterAll(async () => await as.close());
  afterEach(async () => await clearSecurityTestData());

  /** An organization whose admin owns one project, created through the API so it has its primary labels. */
  async function orgWithProject() {
    const org = await createTestOrganization();
    const user = await createOrgUser(call, org.tenantId, org.id, `admin-${nanoid(8)}`, adminRole);
    const path = { tenantId: org.tenantId, organizationId: org.id };
    const headers = { ...defaultHeaders, Cookie: user.sessionCookie };
    const firstId = (result: { data?: unknown }) => String((result.data as { data: { id: string }[] } | undefined)?.data[0].id);
    const workspaces = await call(createWorkspaces, { path, body: [{ id: `temp-${nanoid()}`, name: 'Home' }], headers });
    const projects = await call(createProjects, {
      path,
      query: { workspaceId: firstId(workspaces) },
      body: [{ id: `temp-${nanoid()}`, name: 'Roadmap', slug: `roadmap-${crypto.randomUUID().slice(0, 8)}`, publicAt: null }],
      headers,
    });
    expect(projects.response.status).toBe(201);
    return { org, user, projectId: firstId(projects) };
  }

  async function userToken(scope: string) {
    const owner = await orgWithProject();
    await registerApp({ id: CLIENT_ID, name: 'Task assistant', redirectUris: [REDIRECT_URI] });
    await installApp(owner.org, owner.user.sessionCookie, CLIENT_ID);
    const resource = resourceUri({ face: 'mcp', tenantId: owner.org.tenantId, organizationId: owner.org.id });
    const result = await authorizationCodeToken(as.issuer, {
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      scope,
      resource,
      sessionCookie: owner.user.sessionCookie,
    });
    expect(result.status).toBe(200);
    return { ...owner, jwt: String(result.body.access_token) };
  }

  async function rpc(ctx: { org: { tenantId: string; id: string }; jwt: string }, method: string, params?: unknown) {
    const { response, data, error } = await call(handleMcp, {
      path: { tenantId: ctx.org.tenantId, organizationId: ctx.org.id },
      body: { jsonrpc: '2.0', id: ++rpcId, method, params },
      headers: bearerHeaders(ctx.jwt),
    });
    return { response, rpc: (data ?? error) as Rpc };
  }

  const toolCall = (ctx: Parameters<typeof rpc>[0], name: string, args: unknown) => rpc(ctx, 'tools/call', { name, arguments: args });
  const toolResult = (reply: { rpc: Rpc }) => reply.rpc.result as ToolResult;

  it('a user token creates, lists, reads and renames a task', async () => {
    const ctx = await userToken('task:write');

    const created = await toolCall(ctx, 'createTasks', {
      items: [
        { id: crypto.randomUUID(), name: 'Write the release notes', description: null, projectId: ctx.projectId, status: TaskStatus.Unstarted },
      ],
    });
    expect(created.rpc.error).toBeUndefined();
    expect(toolResult(created).isError).toBeUndefined();
    const { data: tasks } = toolResult(created).structuredContent as { data: { id: string; name: string }[] };
    expect(tasks).toHaveLength(1);
    expect((await adminDb.select().from(tasksTable).where(eq(tasksTable.id, tasks[0].id)))[0].createdBy).toBe(ctx.user.id);

    // `write` implies `read`.
    const listed = await toolCall(ctx, 'getTasks', { projectId: ctx.projectId, limit: '5' });
    expect(toolResult(listed).isError).toBeUndefined();
    expect(toolResult(listed).structuredContent).toMatchObject({ items: [{ id: tasks[0].id }], total: 1 });

    const read = await toolCall(ctx, 'getTask', { id: tasks[0].id });
    expect(toolResult(read).structuredContent).toMatchObject({ id: tasks[0].id, name: 'Write the release notes' });

    const renamed = await toolCall(ctx, 'updateTask', { id: tasks[0].id, ops: { name: 'Write the changelog' } });
    expect(toolResult(renamed).isError).toBeUndefined();
    expect(toolResult(renamed).structuredContent).toMatchObject({ name: 'Write the changelog' });
  });

  it('a read token lists tasks and is stepped up on a write', async () => {
    const ctx = await userToken('task:read');

    const listed = await toolCall(ctx, 'getTasks', { limit: '5' });
    expect(listed.response.status).toBe(200);
    expect(toolResult(listed).isError).toBeUndefined();
    expect(toolResult(listed).structuredContent).toMatchObject({ items: [], total: 0 });

    const write = await toolCall(ctx, 'updateTask', { id: '00000000-0000-4000-8000-000000000000', ops: { name: 'x' } });
    expect(write.response.status).toBe(403);
    expect(write.rpc.error).toMatchObject({ message: 'insufficient_scope', data: { scope: 'task:write' } });
  });

  it('a service account token passes authentication on the task routes', async () => {
    const owner = await orgWithProject();
    const client = await serviceAccountWithKey(owner.org, owner.user.sessionCookie);
    const resource = resourceUri({ face: 'mcp', tenantId: owner.org.tenantId, organizationId: owner.org.id });
    const token = await clientCredentialsToken(as.issuer, client, { scope: 'task:read', resource });
    expect(token.status).toBe(200);

    const listed = await toolCall({ org: owner.org, jwt: String(token.body.access_token) }, 'getTasks', { limit: '5' });
    expect(listed.response.status).toBe(200);
    expect(toolResult(listed).isError).toBeUndefined();
  });
});
