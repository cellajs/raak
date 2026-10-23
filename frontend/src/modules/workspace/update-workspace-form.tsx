import type { UseFormProps } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { Workspace } from 'sdk';
import { zUpdateWorkspaceBody } from 'sdk/zod.gen';
import type { z } from 'zod';
import { useBeforeUnload } from '~/hooks/use-before-unload';
import { useFormWithDraft } from '~/modules/common/form-draft/use-draft-form';
import { CancelButton } from '~/modules/common/form-fields/cancel-button';
import { InputFormField } from '~/modules/common/form-fields/input';
import { SubmitButton } from '~/modules/common/form-fields/submit-button';
import { useSheeter } from '~/modules/common/sheeter/use-sheeter';
import { toaster } from '~/modules/common/toaster/toaster';
import { Form } from '~/modules/ui/field';
import { useUpdateWorkspaceMutation } from '~/modules/workspace/query';
import { formResolver } from '~/utils/form-resolver';

const formSchema = zUpdateWorkspaceBody;
type FormValues = z.infer<typeof formSchema>;
interface Props {
  workspace: Workspace;
  callback?: (workspace: Workspace) => void;
}

function UpdateWorkspaceForm({ workspace, callback }: Props) {
  const { t } = useTranslation();

  const { mutate, isPending } = useUpdateWorkspaceMutation();

  const formOptions: UseFormProps<FormValues> = { resolver: formResolver(formSchema), defaultValues: { name: workspace.name } };

  const formContainerId = 'update-workspace';
  const form = useFormWithDraft<FormValues>(`update-workspace-${workspace.id}`, { formOptions, formContainerId });

  // Prevent data loss
  useBeforeUnload(form.isDirty);

  const onSubmit = (values: FormValues) => {
    mutate(
      { path: { id: workspace.id, organizationId: workspace.organizationId, tenantId: workspace.tenantId }, body: values },
      {
        onSuccess: (updatedWorkspace) => {
          useSheeter.getState().remove('update-workspace');
          form.reset(updatedWorkspace);
          toaster.success(t('c:success.update_resource', { resource: t('c:workspace') }));
          callback?.(updatedWorkspace);
        },
      },
    );
  };

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <InputFormField control={form.control} name="name" label={t('c:name')} required />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SubmitButton disabled={!form.isDirty} loading={isPending}>
            {t('c:save_changes')}
          </SubmitButton>
          <CancelButton dirty={form.isDirty} onClick={() => form.reset()} />
        </div>
      </form>
    </Form>
  );
}

export { UpdateWorkspaceForm };
