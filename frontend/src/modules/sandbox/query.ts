import { queryOptions, useMutation } from '@tanstack/react-query';
import { type ClaimSandboxResponse, claimSandbox, getSandbox, type KeepSandboxData, keepSandbox } from 'sdk';
import type { ApiError } from '~/lib/api';
import type { MutationData } from '~/query/types';

const sandboxKeys = { detail: ['sandbox'] as const, claim: ['sandbox', 'claim'] as const, keep: ['sandbox', 'keep'] as const };

/** The signed-in sandbox account's sandbox: where it opens and when it ends. */
export const sandboxQueryOptions = () => queryOptions({ queryKey: sandboxKeys.detail, queryFn: () => getSandbox(), meta: { persist: false } });

/** Asks for the keep link; the answer is the same whether the address has an account. */
export const useSandboxKeepMutation = () =>
  useMutation<void, ApiError, MutationData<KeepSandboxData>>({
    mutationKey: sandboxKeys.keep,
    mutationFn: async ({ body }) => {
      await keepSandbox({ body });
    },
  });

/** Takes a sandbox for this browser and signs it in; a browser that holds one gets it back. */
export const useSandboxClaimMutation = () =>
  useMutation<ClaimSandboxResponse, ApiError, void>({ mutationKey: sandboxKeys.claim, mutationFn: () => claimSandbox() });
