import { describe, expect, it } from 'vitest';
import { activityListQuerySchema } from '#/modules/activities/activities-schema';
import { memberListQuerySchema } from '#/modules/memberships/memberships-schema';
import { sendNewsletterBodySchema } from '#/modules/system/system-schema';
import { TaskStatus } from '#/modules/task/task-properties';
import { taskCreateManyStxBodySchema, taskUpdateStxBodySchema } from '#/modules/task/task-schema';

const firstId = '00000000-0000-4000-8000-000000000001';
const secondId = '00000000-0000-4000-8000-000000000002';
const hlc = '100:0001:aaaaa';
const stx = (fieldTimestamps: Record<string, string> = {}) => ({
  mutationId: firstId,
  sourceId: 'schema-contract-test',
  fieldTimestamps,
});

describe('activityListQuerySchema', () => {
  it('allows an unfiltered activity list request', () => {
    expect(activityListQuerySchema.safeParse({}).success).toBe(true);
  });
});

describe('memberListQuerySchema', () => {
  const baseQuery = { entityId: firstId, entityType: 'organization' as const };

  it('parses a bounded comma-separated UUID list once at the request boundary', () => {
    expect(memberListQuerySchema.parse({ ...baseQuery, userIds: `${firstId}, ${secondId}` }).userIds).toEqual([
      firstId,
      secondId,
    ]);
  });

  it.each(['', 'not-an-id', `${firstId},`, Array.from({ length: 51 }, () => firstId).join(',')])(
    'rejects invalid member ID list %s',
    (userIds) => {
      expect(memberListQuerySchema.safeParse({ ...baseQuery, userIds }).success).toBe(false);
    },
  );
});

describe('sendNewsletterBodySchema', () => {
  const baseBody = { organizationIds: [firstId], roles: ['member'] as const, subject: 'Subject', content: 'Content' };

  it('keeps an empty organization scope available for toSelf previews', () => {
    expect(sendNewsletterBodySchema.safeParse({ ...baseBody, organizationIds: [] }).success).toBe(true);
  });

  it.each([
    { ...baseBody, organizationIds: ['not-an-id'] },
    { ...baseBody, organizationIds: [firstId, firstId] },
    { ...baseBody, roles: ['member', 'member'] },
  ])('rejects invalid or duplicate targeting values %#', (body) => {
    expect(sendNewsletterBodySchema.safeParse(body).success).toBe(false);
  });
});

describe('task mutation schemas', () => {
  it('accepts only declared task statuses on update', () => {
    const validUpdate = {
      ops: { status: TaskStatus.Started },
      stx: stx({ status: hlc }),
    };
    expect(taskUpdateStxBodySchema.safeParse(validUpdate).success).toBe(true);
    expect(taskUpdateStxBodySchema.safeParse({ ...validUpdate, ops: { status: 999 } }).success).toBe(false);
  });

  it('validates and bounds task relation IDs on create', () => {
    const validTask = {
      id: firstId,
      name: 'Task',
      description: null,
      projectId: secondId,
      status: TaskStatus.Unstarted,
      labels: [firstId],
      assignedTo: [secondId],
      stx: stx(),
    };

    expect(taskCreateManyStxBodySchema.safeParse([validTask]).success).toBe(true);
    expect(taskCreateManyStxBodySchema.safeParse([{ ...validTask, labels: ['not-an-id'] }]).success).toBe(false);
    expect(taskCreateManyStxBodySchema.safeParse([{ ...validTask, labels: [firstId, firstId] }]).success).toBe(false);
  });
});
