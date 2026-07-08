import { inArray } from 'drizzle-orm';
import { getAttachment, getAttachments } from 'sdk';
import { generateId } from 'shared/utils/entity-id';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { baseDb as db } from '#/db/db';
import { attachmentsTable } from '#/modules/attachment/attachment-db';
import { projectsTable } from '#/modules/project/project-db';
import { mockStxBase } from '#/schemas/sync-transaction-mocks';
import { defaultHeaders } from './fixtures';
import { clearSecurityTestData, createOrgUser, createTestTenant, type TestTenant } from './security/helpers';
import { createAppClient } from './test-client';
import { mockFetchRequest, setTestConfig } from './test-utils';

setTestConfig({ enabledAuthStrategies: ['passkey'] });

const projectId = generateId();
const attachmentIds = {
  ownedByA: generateId(),
  ownedByB: generateId(),
  ownedByAdmin: generateId(),
};

// Covers row-conditional attachment reads through policy, collection scope,
// compiled SQL predicate, and HTTP responses.
describe('Attachment own-reads (row-conditional org member policy)', async () => {
  const call = await createAppClient();
  let tenant: TestTenant;
  let memberA: Awaited<ReturnType<typeof createOrgUser>>;
  let memberB: Awaited<ReturnType<typeof createOrgUser>>;

  const listAttachments = async (cookie: string, query: Record<string, string> = {}) => {
    const result = await call(getAttachments, {
      path: { organizationId: tenant.organization.id, tenantId: tenant.tenantId },
      query,
      headers: { ...defaultHeaders, Cookie: cookie },
    });
    const data = result.data as { items: { id: string }[]; total: number } | undefined;
    return { status: result.response.status, ids: (data?.items ?? []).map(({ id }) => id).sort(), total: data?.total };
  };

  const getOne = async (cookie: string, id: string) => {
    const result = await call(getAttachment, {
      path: { organizationId: tenant.organization.id, tenantId: tenant.tenantId, id },
      headers: { ...defaultHeaders, Cookie: cookie },
    });
    return result.response.status;
  };

  beforeAll(async () => {
    mockFetchRequest();
    tenant = await createTestTenant(call, 'attachment-own-reads');
    // Two org members WITHOUT any project membership.
    memberA = await createOrgUser(call, tenant.tenantId, tenant.organization.id, 'attachment-own-a', 'member');
    memberB = await createOrgUser(call, tenant.tenantId, tenant.organization.id, 'attachment-own-b', 'member');

    await db.insert(projectsTable).values({
      id: projectId,
      tenantId: tenant.tenantId,
      organizationId: tenant.organization.id,
      name: 'Own-reads project',
      slug: `own-reads-project-${projectId.slice(0, 8)}`,
      createdBy: tenant.user.id,
    });

    const baseAttachment = {
      tenantId: tenant.tenantId,
      organizationId: tenant.organization.id,
      projectId,
      bucketName: 'test-bucket',
      contentType: 'image/png',
      size: '1024',
      stx: mockStxBase(),
    };
    await db.insert(attachmentsTable).values([
      {
        ...baseAttachment,
        id: attachmentIds.ownedByA,
        name: 'owned by A',
        filename: 'a.png',
        originalKey: `${projectId}/a.png`,
        createdBy: memberA.id,
      },
      {
        ...baseAttachment,
        id: attachmentIds.ownedByB,
        name: 'owned by B',
        filename: 'b.png',
        originalKey: `${projectId}/b.png`,
        createdBy: memberB.id,
      },
      {
        ...baseAttachment,
        id: attachmentIds.ownedByAdmin,
        name: 'owned by admin',
        filename: 'admin.png',
        originalKey: `${projectId}/admin.png`,
        createdBy: tenant.user.id,
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(attachmentsTable).where(inArray(attachmentsTable.id, Object.values(attachmentIds)));
    await db.delete(projectsTable).where(inArray(projectsTable.id, [projectId]));
    await clearSecurityTestData();
  });

  it('P1: aggregate list returns exactly the org member’s own attachments', async () => {
    const a = await listAttachments(memberA.sessionCookie);
    expect(a.status).toBe(200);
    expect(a.ids).toEqual([attachmentIds.ownedByA]);
    expect(a.total).toBe(1);

    const b = await listAttachments(memberB.sessionCookie);
    expect(b.status).toBe(200);
    expect(b.ids).toEqual([attachmentIds.ownedByB]);
  });

  it('P2: explicit ?projectId= without project membership returns own rows instead of 403', async () => {
    const a = await listAttachments(memberA.sessionCookie, { projectId });
    expect(a.status).toBe(200);
    expect(a.ids).toEqual([attachmentIds.ownedByA]);
  });

  it('P3: single GET honors the condition — own 200, foreign 403', async () => {
    expect(await getOne(memberA.sessionCookie, attachmentIds.ownedByA)).toBe(200);
    expect(await getOne(memberA.sessionCookie, attachmentIds.ownedByB)).toBe(403);
    expect(await getOne(memberB.sessionCookie, attachmentIds.ownedByB)).toBe(200);
  });

  it('P4: org admin keeps unconditional read over all attachments', async () => {
    const admin = await listAttachments(tenant.sessionCookie);
    expect(admin.status).toBe(200);
    expect(admin.ids).toEqual(Object.values(attachmentIds).sort());
  });
});
