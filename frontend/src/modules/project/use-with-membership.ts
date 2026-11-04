import { useQuery } from '@tanstack/react-query';
import { myMembershipsQueryOptions } from '~/modules/me/query';
import type { EnrichedProject, ProjectWithMembership } from '~/modules/project/types';
import { findMembership } from '~/query/enrichment/helpers';

/** Joins each project with the caller's membership in it: a board orders its panels and files its projects by it. */
export function useWithMembership(projects: EnrichedProject[]): ProjectWithMembership[] {
  const { data: myMemberships } = useQuery(myMembershipsQueryOptions());
  const memberships = myMemberships?.items ?? [];
  return projects.map((project) => ({ ...project, membership: findMembership(memberships, project.id) }));
}
