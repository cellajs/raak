import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  type ProvisionSampleData,
  type ProvisionSampleResponse,
  provisionSample,
  type RemoveSampleData,
  type RemoveSampleResponse,
  removeSample,
} from 'sdk';
import type { ApiError } from '~/lib/api';
import { meKeys } from '~/modules/me/query';
import { projectQueryKeys } from '~/modules/project/query';
import type { MutationData } from '~/query/types';

const sampleKeys = { provision: ['sample', 'provision'], remove: ['sample', 'remove'] } as const;

// The board, the menu and the project lists find the sample projects through these
const refreshSampleViews = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: projectQueryKeys.list.base });
  queryClient.invalidateQueries({ queryKey: meKeys.memberships });
};

/** Adds the sample to the organization, or the caller to the sample it has. */
export const useSampleProvisionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<ProvisionSampleResponse, ApiError, MutationData<ProvisionSampleData>>({
    mutationKey: sampleKeys.provision,
    mutationFn: ({ path, query }) => provisionSample({ path, query }),
    onSettled: () => refreshSampleViews(queryClient),
  });
};

/** Removes the organization's sample projects and the sample team. */
export const useSampleRemoveMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<RemoveSampleResponse, ApiError, MutationData<RemoveSampleData>>({
    mutationKey: sampleKeys.remove,
    mutationFn: ({ path }) => removeSample({ path }),
    onSettled: () => refreshSampleViews(queryClient),
  });
};
