import '#/modules'; // composition root: the label module gives each new project its task types

import { and, eq, inArray } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { sessionLifetime } from '#/modules/auth/sessions/operations/create-session';
import { demoLifetime, demoPeopleCap } from '#/modules/demo/demo-constants';
import { demosTable } from '#/modules/demo/demo-db';
import { expireDemos } from '#/modules/demo/operations/demo-expiry';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { projectsTable } from '#/modules/project/project-db';
import { samplePersonIds } from '#/modules/sample/sample-content';
import { tenantsTable } from '#/modules/tenants/tenants-db';
import { usersTable } from '#/modules/user/user-db';
import { defaultHeaders } from './fixtures';
import { adminDb, expectRefusal, sentMails } from './helpers';
import { clearSecurityTestData } from './security/helpers';

/** A browser, as the claim and join limiters count them: one address each, and the cookies it was given. */
const browser = (address: string) => {
  let cookie = '';
  const request = async (path: string, init: { method?: string; body?: unknown } = {}) => {
    const { baseApp } = await import('#/routes');
    const response = await baseApp.request(path, {
      method: init.method,
      headers: {
        ...defaultHeaders,
        'x-forwarded-for': address,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        ...(cookie && { Cookie: cookie }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const given = response.headers.getSetCookie().map((line) => line.split(';')[0]);
    if (given.length) cookie = given.join('; ');
    return response;
  };
  return { request };
};

const claim = async (address: string) => {
  const visitor = browser(address);
  const response = await visitor.request('/demo', { method: 'POST' });
  expect(response.status).toBe(201);
  return { visitor, demo: await response.json() };
};

const demoOf = async (shareCode: string) => {
  const [demo] = await adminDb.select().from(demosTable).where(eq(demosTable.shareCode, shareCode));
  return demo;
};

describe('Demos', () => {
  afterEach(async () => await clearSecurityTestData());

  it('ends no later than the session that holds it', () => {
    expect(demoLifetime.milliseconds()).toBeLessThanOrEqual(sessionLifetime.milliseconds());
  });

  it('gives a browser its demo, and back again, and leaves the public counts alone', async () => {
    const countsBefore = await (await browser('10.0.1.9').request('/metrics/public')).json();
    const { visitor, demo } = await claim('10.0.1.1');
    expect(await (await browser('10.0.1.9').request('/metrics/public')).json()).toEqual(countsBefore);
    expect(demo).toMatchObject({
      claimed: true,
      path: expect.stringMatching(/\/workspace\//),
      shareCode: expect.stringMatching(/^[0-9a-f]{16}$/),
    });
    expect(demo.foldedProjectIds).toHaveLength(1);

    const again = await visitor.request('/demo', { method: 'POST' });
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ claimed: false, path: demo.path, shareCode: demo.shareCode });
  });

  it('lets colleagues join through its link until it holds as many people as a demo takes', async () => {
    const { visitor: maya, demo } = await claim('10.0.2.1');
    expect((await maya.request('/me', { method: 'PUT', body: { firstName: 'Maya' } })).status).toBe(200);

    const guests = ['Jonas', 'Lena', 'Sam', 'Tess'].slice(0, demoPeopleCap - 1);
    for (const [index, firstName] of guests.entries()) {
      const guest = browser(`10.0.2.${index + 2}`);
      const joined = await guest.request(`/demo/join/${demo.shareCode}`, { method: 'POST', body: { firstName } });
      expect(joined.status, firstName).toBe(201);
      const answer = await joined.json();
      expect(answer).toMatchObject({ claimed: true, shareCode: demo.shareCode });
      expect(answer.path).not.toBe(demo.path);

      if (index === 0) {
        const back = await guest.request(`/demo/join/${demo.shareCode}`, { method: 'POST', body: { firstName } });
        expect(await back.json()).toMatchObject({ claimed: false, path: answer.path });
      }
    }

    const invite = await (await browser('10.0.2.9').request(`/demo/join/${demo.shareCode}`)).json();
    expect(invite).toMatchObject({ people: ['Maya', ...guests], full: true, joined: false });
    await expectRefusal(
      await browser('10.0.2.10').request(`/demo/join/${demo.shareCode}`, { method: 'POST', body: { firstName: 'Femke' } }),
      409,
      'demo_full',
    );

    // A guest holds what the taker holds: the organization, and every project in it under a workspace of their own
    const { organizationId, guestIds } = await demoOf(demo.shareCode);
    expect(guestIds).toHaveLength(guests.length);
    const projects = await adminDb.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.organizationId, organizationId));
    const held = await adminDb
      .select({ channelType: membershipsTable.channelType, channelId: membershipsTable.channelId })
      .from(membershipsTable)
      .where(and(eq(membershipsTable.userId, guestIds[0]), eq(membershipsTable.organizationId, organizationId)));
    expect(
      held
        .filter(({ channelType }) => channelType === 'project')
        .map(({ channelId }) => channelId)
        .sort(),
    ).toEqual(projects.map(({ id }) => id).sort());
    expect(held.filter(({ channelType }) => channelType === 'organization')).toHaveLength(1);
    expect(held.filter(({ channelType }) => channelType === 'workspace')).toHaveLength(1);
  });

  it('mails no one: its invitations are refused, and it makes no tenant of its own', async () => {
    const { visitor, demo } = await claim('10.0.5.1');
    const { tenantId, organizationId } = await demoOf(demo.shareCode);
    const [project] = await adminDb.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.organizationId, organizationId));
    const invite = (entityType: string, entityId: string, role: string) =>
      visitor.request(`/${tenantId}/${organizationId}/memberships?entityType=${entityType}&entityId=${entityId}`, {
        method: 'POST',
        body: { emails: ['someone@example.com'], role },
      });

    await expectRefusal(await invite('organization', organizationId, 'admin'), 403, 'restrict_by_org', 'organization');
    await expectRefusal(await invite('project', project.id, 'member'), 403, 'restrict_by_org', 'project');
    await expectRefusal(await visitor.request('/tenants/self', { method: 'POST', body: { name: 'Elsewhere' } }), 403, 'restrict_by_app');
    expect(sentMails()).toEqual([]);

    const [tenant] = await adminDb.select({ restrictions: tenantsTable.restrictions }).from(tenantsTable).where(eq(tenantsTable.id, tenantId));
    expect(tenant.restrictions.quotas).toMatchObject({ user: 1, attachment: 1 });
  });

  it('refuses a code no running demo holds', async () => {
    await expectRefusal(await browser('10.0.3.1').request('/demo/join/0000000000000000'), 404, 'demo_ended');
  });

  it('ends after its week with everyone in it, and keeps the sample people', async () => {
    const { demo } = await claim('10.0.4.1');
    expect((await browser('10.0.4.2').request(`/demo/join/${demo.shareCode}`, { method: 'POST', body: { firstName: 'Jonas' } })).status).toBe(201);
    const { userId, guestIds, tenantId } = await demoOf(demo.shareCode);

    await adminDb
      .update(demosTable)
      .set({ expiresAt: new Date(Date.now() - 60_000).toISOString() })
      .where(eq(demosTable.shareCode, demo.shareCode));
    await expireDemos();

    expect(await demoOf(demo.shareCode)).toBeUndefined();
    expect(
      await adminDb
        .select()
        .from(usersTable)
        .where(inArray(usersTable.id, [userId, ...guestIds])),
    ).toEqual([]);
    expect(await adminDb.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId))).toEqual([]);
    expect(await adminDb.select({ id: usersTable.id }).from(usersTable).where(inArray(usersTable.id, samplePersonIds))).toHaveLength(
      samplePersonIds.length,
    );
  });
});
