import { queryOptions, useMutation } from '@tanstack/react-query';
import { type ClaimSandboxResponse, claimSandbox, getSandbox } from 'sdk';
import type { ApiError } from '~/lib/api';

const sandboxKeys = { detail: ['sandbox'] as const, claim: ['sandbox', 'claim'] as const };

/** The signed-in sandbox account's sandbox: where it opens and when it ends. */
export const sandboxQueryOptions = () => queryOptions({ queryKey: sandboxKeys.detail, queryFn: () => getSandbox(), meta: { persist: false } });

/** Takes a sandbox for this browser and signs it in; a browser that holds one gets it back. */
export const useSandboxClaimMutation = () =>
  useMutation<ClaimSandboxResponse, ApiError, void>({ mutationKey: sandboxKeys.claim, mutationFn: () => claimSandbox() });
