import { createProjects, createWorkspaces } from 'sdk';
import { nanoid } from 'shared/utils/nanoid';
import { expect } from 'vitest';
import { defaultHeaders } from '../fixtures';
import type { createAppClient, TestResult } from '../test-client';

type Call = Awaited<ReturnType<typeof createAppClient>>;

/**
 * A project `as` creates through the API in a workspace of its own, so it carries its primary labels and its creator
 * is its admin. Resolves to the workspace and project ids.
 */
export async function createApiProject(
  call: Call,
  path: { tenantId: string; organizationId: string },
  as: { sessionCookie: string },
  isPublic = false,
) {
  const headers = { ...defaultHeaders, Cookie: as.sessionCookie };
  const firstId = ({ data }: TestResult) => String((data as { data: { id: string }[] } | undefined)?.data[0]?.id);
  const workspace = await call(createWorkspaces, { path, body: [{ id: `temp-${nanoid()}`, name: 'Home' }], headers });
  expect(workspace.response.status).toBe(201);
  const workspaceId = firstId(workspace);
  const project = await call(createProjects, {
    path,
    query: { workspaceId },
    body: [{ id: `temp-${nanoid()}`, name: 'Project', slug: `project-${nanoid(8).toLowerCase()}`, public: isPublic }],
    headers,
  });
  expect(project.response.status).toBe(201);
  return { workspaceId, projectId: firstId(project) };
}
