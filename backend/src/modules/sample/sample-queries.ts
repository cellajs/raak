import { and, eq, inArray, sql } from 'drizzle-orm';
import { appConfig } from 'shared';
import type { DbContext } from '#/core/context';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { projectsTable } from '#/modules/project/project-db';
import { sampleContent, samplePersonIds } from '#/modules/sample/sample-content';
import { insertUsers } from '#/modules/user/user-queries';

/** The organization's sample: the projects a sample person created there. */
export const findSampleProjects = async (ctx: DbContext, { organizationId }: { organizationId: string }) =>
  ctx.var.db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.organizationId, organizationId), inArray(projectsTable.createdBy, samplePersonIds)));

/** Removes every membership the sample people hold in the organization. */
export const deleteSamplePersonMemberships = async (ctx: DbContext, { organizationId }: { organizationId: string }) =>
  ctx.var.db
    .delete(membershipsTable)
    .where(and(eq(membershipsTable.organizationId, organizationId), inArray(membershipsTable.userId, samplePersonIds)))
    .returning({ id: membershipsTable.id });

/** Holds the organization's sample until the transaction ends, so two members adding it at once make one. */
export const lockOrganizationSample = async (ctx: DbContext, { organizationId }: { organizationId: string }) => {
  await ctx.var.db.execute(sql`select pg_advisory_xact_lock(hashtext(${`sample:${organizationId}`}))`);
};

/**
 * Creates the sample people's accounts where missing. They have no email row, so no mail reaches them and nobody can
 * sign in as them; the address is a placeholder under the reserved `.invalid` domain.
 */
export const insertSamplePeople = async (ctx: DbContext) =>
  insertUsers(ctx, {
    users: sampleContent.people.map(({ key, id, firstName, lastName }) => ({
      id,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      slug: `sample-${key}`,
      email: `${key}@sample.invalid`,
      language: appConfig.defaultLanguage,
    })),
    onConflictDoNothing: true,
  });
