import { queryOptions, useMutation } from '@tanstack/react-query';
import { type ClaimDemoResponse, claimDemo, getDemo, getDemoInvite, type JoinDemoResponse, joinDemo } from 'sdk';
import type { ApiError } from '~/lib/api';

const demoKeys = { detail: ['demo'] as const, claim: ['demo', 'claim'] as const, join: ['demo', 'join'] as const };

/** A share link's own page answers these, so no toast repeats them. */
const isInviteRefusal = (error: ApiError) => error.type === 'demo_ended' || error.type === 'demo_full';

/** The signed-in demo account's demo: where it opens, when it ends, and its share code. */
export const demoQueryOptions = () => queryOptions({ queryKey: demoKeys.detail, queryFn: () => getDemo(), meta: { persist: false } });

/** Who is in the demo a share link leads to, and whether this browser is in it. */
export const demoInviteQueryOptions = (shareCode: string) =>
  queryOptions({
    queryKey: ['demo', 'invite', shareCode],
    queryFn: () => getDemoInvite({ path: { shareCode } }),
    retry: false,
    meta: { persist: false, suppressGlobalErrorToast: isInviteRefusal },
  });

/** Takes a demo for this browser and signs it in; a browser that holds one gets it back. */
export const useDemoClaimMutation = () =>
  useMutation<ClaimDemoResponse, ApiError, void>({ mutationKey: demoKeys.claim, mutationFn: () => claimDemo() });

/** Lets this browser into the demo of a share link, signed in under the first name it gives. */
export const useDemoJoinMutation = () =>
  useMutation<JoinDemoResponse, ApiError, { shareCode: string; firstName: string }>({
    mutationKey: demoKeys.join,
    mutationFn: ({ shareCode, firstName }) => joinDemo({ path: { shareCode }, body: { firstName } }),
    meta: { suppressGlobalErrorToast: isInviteRefusal },
  });
