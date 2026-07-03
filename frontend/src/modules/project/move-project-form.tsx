import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import type { UseFormProps } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { Workspace } from 'sdk';
import { zMoveProjectToWorkspacePath, zMoveProjectToWorkspaceQuery } from 'sdk/zod.gen';
import { z } from 'zod';
import { useFormWithDraft } from '~/modules/common/form-draft/use-draft-form';
import { SelectParentFormField } from '~/modules/common/form-fields/select-combobox/parent';
import { useProjectMoveMutation } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { Button, SubmitButton } from '~/modules/ui/button';
import { Form } from '~/modules/ui/field';

const formSchema = z.object({
  ...zMoveProjectToWorkspacePath.shape,
  ...zMoveProjectToWorkspaceQuery.shape,
});
type FormValues = z.infer<typeof formSchema>;

interface MoveProjectFormProps {
  project: EnrichedProject;
  workspaces: Workspace[];
  onSuccess?: () => void;
}

export const MoveProjectForm = ({ project, workspaces, onSuccess }: MoveProjectFormProps) => {
  const { t } = useTranslation();

  const options = workspaces.map(({ id: value, name: label, thumbnailUrl: url }) => ({ value, label, url })) || [];

  const formOptions: UseFormProps<FormValues> = useMemo(
    () => ({
      resolver: zodResolver(formSchema),
      defaultValues: {
        id: project.id,
        organizationId: project.organizationId,
        tenantId: project.tenantId,
        workspaceId: project.membership?.workspaceId ?? '',
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
        currentWorkspaceId: project.membership?.workspaceId ?? values.workspaceId,
      },
      {
        onSuccess: () => {
          form.reset();
          onSuccess?.();
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
