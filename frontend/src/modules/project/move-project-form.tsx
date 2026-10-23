import { useMemo } from 'react';
import type { UseFormProps } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { Workspace } from 'sdk';
import { zMoveProjectToWorkspaceQuery } from 'sdk/zod.gen';
import type { z } from 'zod';
import { useFormWithDraft } from '~/modules/common/form-draft/use-draft-form';
import { CancelButton } from '~/modules/common/form-fields/cancel-button';
import { SelectParentFormField } from '~/modules/common/form-fields/select-combobox/parent';
import { SubmitButton } from '~/modules/common/form-fields/submit-button';
import { toaster } from '~/modules/common/toaster/toaster';
import { useProjectMoveMutation } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { Form } from '~/modules/ui/field';
import { formResolver } from '~/utils/form-resolver';

const formSchema = zMoveProjectToWorkspaceQuery;
type FormValues = z.infer<typeof formSchema>;

interface MoveProjectFormProps {
  project: EnrichedProject;
  workspaces: Workspace[];
  onSuccess?: () => void;
}

export function MoveProjectForm({ project, workspaces, onSuccess }: MoveProjectFormProps) {
  const { t } = useTranslation();

  const options = workspaces.map(({ id: value, name: label, thumbnailUrl: url }) => ({ value, label, url }));

  const formOptions: UseFormProps<FormValues> = useMemo(
    () => ({
      resolver: formResolver(formSchema),
      defaultValues: { workspaceId: project.membership?.workspaceId ?? '' },
    }),
    [],
  );

  // Form with draft in local storage
  const form = useFormWithDraft<FormValues>(`move-project-${project.id}`, { formOptions });
  const { mutate: move, isPending } = useProjectMoveMutation();

  const onSubmit = (values: FormValues) => {
    move(
      {
        path: { id: project.id, organizationId: project.organizationId, tenantId: project.tenantId },
        query: { workspaceId: values.workspaceId },
        currentWorkspaceId: project.membership?.workspaceId ?? values.workspaceId,
      },
      {
        onSuccess: () => {
          toaster.success(t('c:success.project_moved'));
          form.reset();
          onSuccess?.();
        },
      },
    );
  };

  if (form.loading) return null;

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <SelectParentFormField parentType="workspace" control={form.control} label={t('c:workspace')} options={options} name="workspaceId" required />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SubmitButton disabled={!form.isDirty} loading={isPending}>
            {t('c:move')}
          </SubmitButton>
          <CancelButton dirty={form.isDirty} onClick={() => form.reset()} />
        </div>
      </form>
    </Form>
  );
}
