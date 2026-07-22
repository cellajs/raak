import { zodResolver } from '@hookform/resolvers/zod';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { UseFormProps } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { Workspace } from 'sdk';
import { zChannelBase } from 'sdk/zod.gen';
import { z } from 'zod';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { useFormWithDraft } from '~/modules/common/form-draft/use-draft-form';
import { SelectParentFormField } from '~/modules/common/form-fields/select-combobox/parent';
import { useAssignProjectMutation } from '~/modules/project/query';
import { ProjectSuggestionCombobox } from '~/modules/project/suggestions-combobox';
import { Button, SubmitButton } from '~/modules/ui/button';
import { Form, FormField, FormItem, FormLabel, FormMessage } from '~/modules/ui/field';
import { workspacesListQueryOptions } from '~/modules/workspace/query';
import { useWorkspaceContext } from '~/modules/workspace/use-workspace-context';
import { flattenInfiniteData } from '~/query/basic/flatten';

const formSchema = z.object({
  selectedProjects: z.array(zChannelBase).min(1),
  organizationId: z.string(),
  workspaceId: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

interface SelectProjectFormProps {
  dialog?: boolean;
  callback?: () => void;
}

export const SelectProjectForm: React.FC<SelectProjectFormProps> = ({ dialog: isDialog, callback }) => {
  const { t } = useTranslation();
  const { workspace, organization } = useWorkspaceContext();

  const organizationId = workspace.organizationId;
  const workspaceId = workspace.id;

  // Get workspaces for this organization from cache (populated by menu)
  const { data: workspacesData } = useInfiniteQuery({
    ...workspacesListQueryOptions({ organizationId: workspace.organizationId }),
    refetchOnMount: false,
  });
  const workspaces = flattenInfiniteData<Workspace>(workspacesData);

  const options = useMemo(
    () => workspaces.map(({ name: label, thumbnailUrl: url, id: value }) => ({ value, label, url })) || [],
    [workspaces],
  );

  const formOptions: UseFormProps<FormValues> = useMemo(
    () => ({
      resolver: zodResolver(formSchema),
      defaultValues: { selectedProjects: [], organizationId, workspaceId },
    }),
    [workspaceId],
  );

  const form = useFormWithDraft<FormValues>(`select-project-${workspaceId}`, { formOptions });

  const { mutateAsync: assign, isPending } = useAssignProjectMutation();
  const [pendingCount, setPendingCount] = useState(0);

  const onSubmit = async ({ selectedProjects, ...restValues }: FormValues) => {
    if (!selectedProjects.length) return;

    setPendingCount(selectedProjects.length);

    await Promise.allSettled(
      selectedProjects.map((project) =>
        assign({
          path: { id: project.id, organizationId: restValues.organizationId, tenantId: workspace.tenantId },
          query: { workspaceId: restValues.workspaceId },
          workspaceName: workspace.name,
        }),
      ),
    );

    setPendingCount(0);
    form.reset();
    callback?.();
    if (isDialog) useDialoger.getState().remove();
  };

  const selectedCount = form.watch('selectedProjects')?.length ?? 0;

  if (form.loading) return null;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="selectedProjects"
          render={({ field: { value, onChange } }) => (
            <FormItem name={'id'}>
              <FormLabel>
                {t('c:project_other')}
                <span className="ml-1 opacity-50">*</span>
              </FormLabel>
              <ProjectSuggestionCombobox
                value={value}
                onChange={onChange}
                workspaceId={workspace.id}
                tenantId={workspace.tenantId}
                targetOrgId={workspace.organizationId}
                organizationName={organization.name}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <SelectParentFormField
          parentType="workspace"
          control={form.control}
          label={t('c:workspace')}
          options={options}
          name="workspaceId"
          disabled
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SubmitButton disabled={selectedCount === 0} loading={isPending || pendingCount > 0}>
            {selectedCount > 0
              ? t('c:add_resource', {
                  resource: `${selectedCount} ${t('c:project', { count: selectedCount }).toLowerCase()}`,
                })
              : t('c:select')}
          </SubmitButton>
          <Button
            type="reset"
            variant="secondary"
            className={selectedCount > 0 ? '' : 'invisible'}
            aria-label="Cancel"
            onClick={() => form.reset()}
          >
            {t('c:cancel')}
          </Button>
        </div>
      </form>
    </Form>
  );
};
