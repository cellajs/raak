import type { UseFormProps } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { Workspace } from 'sdk';
import { zUpdateWorkspaceBody } from 'sdk/zod.gen';
import type { z } from 'zod';
import { useBeforeUnload } from '~/hooks/use-before-unload';
import { useFormWithDraft } from '~/modules/common/form-draft/use-draft-form';
import { CancelButton } from '~/modules/common/form-fields/cancel-button';
import { FormActions } from '~/modules/common/form-fields/form-actions';
import { InputFormField } from '~/modules/common/form-fields/input';
import { SubmitButton } from '~/modules/common/form-fields/submit-button';
import { sheeter } from '~/modules/common/sheeter/use-sheeter';
import { toaster } from '~/modules/common/toaster/toaster';
import { Form } from '~/modules/ui/field';
import { useWorkspaceUpdateMutation } from '~/modules/workspace/query';
import { formResolver } from '~/utils/form-resolver';

const formSchema = zUpdateWorkspaceBody;
type FormValues = z.infer<typeof formSchema>;
interface UpdateWorkspaceFormProps {
  workspace: Workspace;
  callback?: (workspace: Workspace) => void;
}

export function UpdateWorkspaceForm({ workspace, callback }: UpdateWorkspaceFormProps) {
  const { t } = useTranslation();

  const { mutate, isPending } = useWorkspaceUpdateMutation();

  const formOptions: UseFormProps<FormValues> = { resolver: formResolver(formSchema), defaultValues: { name: workspace.name } };

  const formContainerId = 'update-workspace';
  const form = useFormWithDraft<FormValues>(`update-workspace-${workspace.id}`, { formOptions, formContainerId });

  useBeforeUnload(form.isDirty);

  const onSubmit = (values: FormValues) => {
    mutate(
      { path: { id: workspace.id, organizationId: workspace.organizationId, tenantId: workspace.tenantId }, body: values },
      {
        onSuccess: (updatedWorkspace) => {
          sheeter.getState().remove('update-workspace');
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
        <FormActions>
          <SubmitButton disabled={!form.isDirty} loading={isPending}>
            {t('c:save_changes')}
          </SubmitButton>
          <CancelButton dirty={form.isDirty} onClick={() => form.reset()} />
        </FormActions>
      </form>
    </Form>
  );
}
