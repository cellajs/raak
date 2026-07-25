import { eq } from 'drizzle-orm';
import { updateLabel } from 'sdk';
import { generateId } from 'shared/utils/entity-id';
import { hashSourceId } from 'shared/utils/hash-source-id';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { baseDb as db } from '#/db/db';
import { labelsTable } from '#/modules/label/label-db';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { projectsTable } from '#/modules/project/project-db';
import { mockStxBase } from '#/schemas/sync-transaction-mocks';
import { defaultHeaders } from './fixtures';
import { clearSecurityTestData, createOrgUser, createTestTenant, type TestTenant } from './security/helpers';
import { createAppClient } from './test-client';
import { mockFetchRequest, setTestConfig } from './test-utils';

setTestConfig({ enabledAuthStrategies: ['passkey'] });

const projectId = generateId();
const epicLabelId = generateId();
const secondaryLabelId = generateId();

const descriptionBlocks = JSON.stringify([
  {
    id: 'b1',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'Epic scope and rollout notes', styles: {} }],
    children: [],
  },
]);

/** Client-shaped stx with an HLC timestamp per edited field (required by the update schema). */
const buildStx = (fieldNames: string[]) => {
  const sourceId = uuidv7();
  const now = Date.now();
  const fieldTimestamps: Record<string, string> = {};
  fieldNames.forEach((field, index) => {
    fieldTimestamps[field] = `${now}:${String(index).padStart(4, '0')}:${hashSourceId(sourceId)}`;
  });
  return { mutationId: uuidv7(), sourceId, fieldTimestamps };
};

const updateOps = (ops: Record<string, unknown>) => ({ ops, stx: buildStx(Object.keys(ops)) });

// Covers the epic-description rules on updateLabelOp: only epics carry a description,
// description-only ops skip the project-admin gate (any project member documents an epic),
// and identity edits on epics stay admin-only.
describe('Label description gates (epic documentation)', async () => {
  const call = await createAppClient();
  let tenant: TestTenant;
  let member: Awaited<ReturnType<typeof createOrgUser>>;

  beforeAll(async () => {
    mockFetchRequest();
    tenant = await createTestTenant(call, 'label-desc-gates');
    member = await createOrgUser(call, tenant.tenantId, tenant.organization.id, 'label-desc-member', 'member');

    await db.insert(projectsTable).values({
      id: projectId,
      tenantId: tenant.tenantId,
      organizationId: tenant.organization.id,
      name: 'Epic gates project',
      slug: `epic-gates-${projectId.slice(0, 8)}`,
      createdBy: tenant.user.id,
    });

    // The second user is a plain project member: may edit epic descriptions, not identities
    await db.insert(membershipsTable).values({
      id: generateId(),
      tenantId: tenant.tenantId,
      channelType: 'project',
      channelId: projectId,
      userId: member.id,
      role: 'member',
      displayOrder: 1,
      createdBy: tenant.user.id,
      organizationId: tenant.organization.id,
      projectId,
    });

    const baseLabel = {
      tenantId: tenant.tenantId,
      organizationId: tenant.organization.id,
      projectId,
      createdBy: tenant.user.id,
      stx: mockStxBase(),
    };
    await db.insert(labelsTable).values([
      { ...baseLabel, id: epicLabelId, name: 'Checkout revamp', slug: 'checkout-revamp', mode: 'epic' },
      { ...baseLabel, id: secondaryLabelId, name: 'urgent', slug: 'urgent', mode: 'secondary' },
    ]);
  });

  afterAll(async () => {
    await clearSecurityTestData();
  });

  const path = (id: string) => ({ tenantId: tenant.tenantId, organizationId: tenant.organization.id, id });

  it('rejects description ops on secondary labels', async () => {
    const { response } = await call(updateLabel, {
      path: path(secondaryLabelId),
      body: updateOps({ description: descriptionBlocks }),
      headers: { ...defaultHeaders, Cookie: tenant.sessionCookie },
    });
    expect(response.status).toBe(403);
  });

  it('lets a project member document an epic (description-only skips the admin gate)', async () => {
    const { response } = await call(updateLabel, {
      path: path(epicLabelId),
      body: updateOps({ description: descriptionBlocks }),
      headers: { ...defaultHeaders, Cookie: member.sessionCookie },
    });
    expect(response.status).toBe(200);

    const [row] = await db.select().from(labelsTable).where(eq(labelsTable.id, epicLabelId));
    expect(row.description).toBe(descriptionBlocks);
    // Keywords are derived from the description so the shared board search matches epics
    expect(row.keywords).toContain('epic');
  });

  it('still requires project-admin authority for epic identity edits by a member', async () => {
    const { response } = await call(updateLabel, {
      path: path(epicLabelId),
      body: updateOps({ name: 'Renamed by member' }),
      headers: { ...defaultHeaders, Cookie: member.sessionCookie },
    });
    expect(response.status).toBe(403);
  });

  it('allows epic identity edits for an org admin', async () => {
    const { response } = await call(updateLabel, {
      path: path(epicLabelId),
      body: updateOps({ name: 'Checkout revamp v2' }),
      headers: { ...defaultHeaders, Cookie: tenant.sessionCookie },
    });
    expect(response.status).toBe(200);
  });
});
