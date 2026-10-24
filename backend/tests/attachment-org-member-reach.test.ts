import { eq, inArray } from 'drizzle-orm';
import { type CreateAttachmentsData, createAttachments, getAttachment, getAttachments } from 'sdk';
import { generateId } from 'shared/utils/entity-id';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { baseDb as db } from '#/db/db';
import { attachmentsTable } from '#/modules/attachment/attachment-db';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { projectsTable } from '#/modules/project/project-db';
import { mockStxBase } from '#/schemas/sync-transaction-mocks';
import { defaultHeaders } from './fixtures';
import { adminDb } from './helpers';
import { clearSecurityTestData, createOrgUser, createTestTenant, type TestTenant } from './security/helpers';
import { createAppClient } from './test-client';
import { setTestConfig } from './test-utils';

setTestConfig({ enabledAuthStrategies: ['passkey'] });

const projectId = generateId();
const siblingId = generateId();
const attachmentIds = { ownedByOutsider: generateId(), ownedByMember: generateId(), ownedByAdmin: generateId() };

// Only org admins are elevated: an org membership, also the one a project invite escalates to, reaches no attachment
// homed in a project.
describe('Attachment reach of an organization member', async () => {
  const call = await createAppClient();
  let tenant: TestTenant;
  let outsider: Awaited<ReturnType<typeof createOrgUser>>;
  let member: Awaited<ReturnType<typeof createOrgUser>>;
  let guest: Awaited<ReturnType<typeof createOrgUser>>;

  const listAttachments = async (cookie: string, query: Record<string, string> = {}) => {
    const result = await call(getAttachments, {
      path: { organizationId: tenant.organization.id, tenantId: tenant.tenantId },
      query,
      headers: { ...defaultHeaders, Cookie: cookie },
    });
    const data = result.data as { items: { id: string }[] } | undefined;
    return { status: result.response.status, ids: (data?.items ?? []).map(({ id }) => id).sort() };
  };

  const getOne = async (cookie: string, id: string) => {
    const result = await call(getAttachment, {
      path: { organizationId: tenant.organization.id, tenantId: tenant.tenantId, id },
      headers: { ...defaultHeaders, Cookie: cookie },
    });
    return result.response.status;
  };

  const upload = async (cookie: string, home: string) => {
    const id = generateId();
    const body = {
      id,
      filename: 'file.pdf',
      contentType: 'application/pdf',
      size: '1024',
      keys: { original: `blob:http://localhost:3000/${id}` },
      projectId: home,
      stx: { mutationId: id, sourceId: 'test', fieldTimestamps: {} },
    } as CreateAttachmentsData['body'][number];
    const result = await call(createAttachments, {
      path: { organizationId: tenant.organization.id, tenantId: tenant.tenantId },
      body: [body],
      headers: { ...defaultHeaders, Cookie: cookie },
    });
    return result.response.status;
  };

  const joinProject = (userId: string, role: 'member' | 'guest') =>
    db.insert(membershipsTable).values({
      id: generateId(),
      tenantId: tenant.tenantId,
      organizationId: tenant.organization.id,
      channelType: 'project',
      channelId: projectId,
      projectId,
      userId,
      role,
      displayOrder: 1,
      createdBy: tenant.user.id,
    });

  beforeAll(async () => {
    tenant = await createTestTenant(call, 'attachment-reach');
    outsider = await createOrgUser(call, tenant.tenantId, tenant.organization.id, 'attachment-reach-outsider', 'member');
    member = await createOrgUser(call, tenant.tenantId, tenant.organization.id, 'attachment-reach-member', 'member');
    guest = await createOrgUser(call, tenant.tenantId, tenant.organization.id, 'attachment-reach-guest', 'member');

    await db.insert(projectsTable).values(
      [projectId, siblingId].map((id) => ({
        id,
        tenantId: tenant.tenantId,
        organizationId: tenant.organization.id,
        name: 'Reach project',
        slug: `reach-project-${id.slice(-12)}`,
        createdBy: tenant.user.id,
      })),
    );
    await joinProject(member.id, 'member');
    await joinProject(guest.id, 'guest');

    const baseAttachment = {
      tenantId: tenant.tenantId,
      organizationId: tenant.organization.id,
      projectId,
      bucketName: 'test-bucket',
      contentType: 'image/png',
      size: '1024',
      stx: mockStxBase(),
    };
    // The outsider uploaded theirs while still a project member
    await db.insert(attachmentsTable).values([
      {
        ...baseAttachment,
        id: attachmentIds.ownedByOutsider,
        name: 'owned by outsider',
        filename: 'outsider.png',
        keys: { original: `${tenant.organization.id}/${outsider.id}/outsider.png` },
        createdBy: outsider.id,
      },
      {
        ...baseAttachment,
        id: attachmentIds.ownedByMember,
        name: 'owned by member',
        filename: 'member.png',
        keys: { original: `${tenant.organization.id}/${member.id}/member.png` },
        createdBy: member.id,
      },
      {
        ...baseAttachment,
        id: attachmentIds.ownedByAdmin,
        name: 'owned by admin',
        filename: 'admin.png',
        keys: { original: `${tenant.organization.id}/${tenant.user.id}/admin.png` },
        createdBy: tenant.user.id,
      },
    ]);
  });

  afterAll(async () => {
    await adminDb.delete(attachmentsTable).where(eq(attachmentsTable.tenantId, tenant.tenantId));
    await db.delete(projectsTable).where(inArray(projectsTable.id, [projectId, siblingId]));
    await clearSecurityTestData();
  });

  it("must not list a project's attachments, own included, to an org member outside the project", async () => {
    expect(await listAttachments(outsider.sessionCookie)).toEqual({ status: 200, ids: [] });
    expect(await listAttachments(outsider.sessionCookie, { channelId: projectId })).toEqual({ status: 200, ids: [] });
  });

  it('must not serve one of them, own included, to an org member outside the project', async () => {
    expect(await getOne(outsider.sessionCookie, attachmentIds.ownedByOutsider)).toBe(404);
    expect(await getOne(outsider.sessionCookie, attachmentIds.ownedByAdmin)).toBe(404);
  });

  it('must not let a project guest upload through the org membership its invite escalated to', async () => {
    expect(await upload(guest.sessionCookie, projectId)).toBe(403);
    expect(await upload(guest.sessionCookie, siblingId)).toBe(403);
    expect(await upload(member.sessionCookie, siblingId)).toBe(403);
  });

  it('lets a project member read and upload in the project, and an org admin read all (positive controls)', async () => {
    expect((await listAttachments(member.sessionCookie, { channelId: projectId })).ids).toEqual(Object.values(attachmentIds).sort());
    expect(await getOne(member.sessionCookie, attachmentIds.ownedByOutsider)).toBe(200);
    expect(await upload(member.sessionCookie, projectId)).toBe(201);
    expect((await listAttachments(tenant.sessionCookie)).ids).toEqual(expect.arrayContaining(Object.values(attachmentIds)));
  });
});
