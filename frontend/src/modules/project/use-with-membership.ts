import { useQuery } from '@tanstack/react-query';
import { myMembershipsQueryOptions } from '~/modules/me/query';
import type { EnrichedProject, ProjectWithMembership } from '~/modules/project/types';
import { useUserStore } from '~/modules/user/user-store';
import { findMembership } from '~/query/enrichment/helpers';

/** Joins each project with the caller's membership in it: a board orders its panels and files its projects by it. A public board without a session fetches none. */
export function useWithMembership(projects: EnrichedProject[]): ProjectWithMembership[] {
  const user = useUserStore((state) => state.user);
  const { data: myMemberships } = useQuery({ ...myMembershipsQueryOptions(), enabled: !!user });
  const memberships = myMemberships?.items ?? [];
  return projects.map((project) => ({ ...project, membership: findMembership(memberships, project.id) }));
}
