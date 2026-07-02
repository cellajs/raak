import { zodResolver } from '@hookform/resolvers/zod';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { UseFormProps } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { Project, Workspace } from 'sdk';
import { zMoveProjectToWorkspacePath, zMoveProjectToWorkspaceQuery } from 'sdk/zod.gen';
import { z } from 'zod';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { useFormWithDraft } from '~/modules/common/form-draft/use-draft-form';
import { SelectParentFormField } from '~/modules/common/form-fields/select-combobox/parent';
import { useProjectMoveMutation } from '~/modules/project/query';
import { Button, SubmitButton } from '~/modules/ui/button';
import { Form } from '~/modules/ui/field';
import { workspacesListQueryOptions } from '~/modules/workspace/query';
import { useWorkspaceContext } from '~/modules/workspace/use-workspace-context';
import { flattenInfiniteData } from '~/query/basic';

const formSchema = z.object({
  ...zMoveProjectToWorkspacePath.shape,
  ...zMoveProjectToWorkspaceQuery.shape,
});
type FormValues = z.infer<typeof formSchema>;

interface MoveProjectFormProps {
  project: Project;
  dialog?: boolean;
}

export const MoveProjectForm = ({ project, dialog: isDialog }: MoveProjectFormProps) => {
  const { t } = useTranslation();

  const { workspace } = useWorkspaceContext();

  // Get workspaces for this organization from cache (populated by menu)
  const { data: workspacesData } = useInfiniteQuery({
    ...workspacesListQueryOptions({ organizationId: project.organizationId }),
    refetchOnMount: false,
  });
  const workspaces = flattenInfiniteData<Workspace>(workspacesData);

  const options = workspaces.map(({ name: label, thumbnailUrl: url, slug: value }) => ({ value, label, url })) || [];

  const formOptions: UseFormProps<FormValues> = useMemo(
    () => ({
      resolver: zodResolver(formSchema),
      defaultValues: {
        id: project.id,
        organizationId: project.organizationId,
        tenantId: workspace.tenantId,
        workspaceId: workspace.id,
      },
    }),
    [],
  );

  // Form with draft in local storage
  const form = useFormWithDraft<FormValues>(`move-project-${project.id}`, { formOptions });
  const { mutate: move, isPending } = useProjectMoveMutation();

  const onSubmit = (values: FormValues) => {
    move(
      {
        path: { id: values.id, organizationId: values.organizationId, tenantId: values.tenantId },
        query: { workspaceId: values.workspaceId },
        currentWorkspaceId: workspace.id,
      },
      {
        onSuccess: () => {
          form.reset();
          if (isDialog) useDialoger.getState().remove();
        },
      },
    );
  };

  if (form.loading) return null;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <SelectParentFormField
          parentType="workspace"
          control={form.control}
          label={t('c:workspace')}
          options={options}
          name="workspaceId"
          required
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SubmitButton disabled={!form.isDirty} loading={isPending}>
            {t('c:move')}
          </SubmitButton>
          <Button
            type="reset"
            variant="secondary"
            className={form.isDirty ? '' : 'invisible'}
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
