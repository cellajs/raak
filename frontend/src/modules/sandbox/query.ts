import { queryOptions, useMutation } from '@tanstack/react-query';
import { type ClaimSandboxResponse, claimSandbox, getSandbox, getSandboxInvite, type JoinSandboxResponse, joinSandbox } from 'sdk';
import type { ApiError } from '~/lib/api';

const sandboxKeys = { detail: ['sandbox'] as const, claim: ['sandbox', 'claim'] as const, join: ['sandbox', 'join'] as const };

/** A share link's own page answers these, so no toast repeats them. */
const isInviteRefusal = (error: ApiError) => error.type === 'sandbox_ended' || error.type === 'sandbox_full';

/** The signed-in sandbox account's sandbox: where it opens, when it ends, and its share code. */
export const sandboxQueryOptions = () => queryOptions({ queryKey: sandboxKeys.detail, queryFn: () => getSandbox(), meta: { persist: false } });

/** Who is in the sandbox a share link leads to, and whether this browser is in it. */
export const sandboxInviteQueryOptions = (shareCode: string) =>
  queryOptions({
    queryKey: ['sandbox', 'invite', shareCode],
    queryFn: () => getSandboxInvite({ path: { shareCode } }),
    retry: false,
    meta: { persist: false, suppressGlobalErrorToast: isInviteRefusal },
  });

/** Takes a sandbox for this browser and signs it in; a browser that holds one gets it back. */
export const useSandboxClaimMutation = () =>
  useMutation<ClaimSandboxResponse, ApiError, void>({ mutationKey: sandboxKeys.claim, mutationFn: () => claimSandbox() });

/** Lets this browser into the sandbox of a share link, signed in under the first name it gives. */
export const useSandboxJoinMutation = () =>
  useMutation<JoinSandboxResponse, ApiError, { shareCode: string; firstName: string }>({
    mutationKey: sandboxKeys.join,
    mutationFn: ({ shareCode, firstName }) => joinSandbox({ path: { shareCode }, body: { firstName } }),
    meta: { suppressGlobalErrorToast: isInviteRefusal },
  });
