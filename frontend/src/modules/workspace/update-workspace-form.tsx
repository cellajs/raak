import { zodResolver } from '@hookform/resolvers/zod';
import type { UseFormProps } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { Workspace } from 'sdk';
import { zUpdateWorkspaceBody } from 'sdk/zod.gen';
import type { z } from 'zod';
import { useBeforeUnload } from '~/hooks/use-before-unload';
import { useFormWithDraft } from '~/modules/common/form-draft/use-draft-form';
import { InputFormField } from '~/modules/common/form-fields/input';
import { useSheeter } from '~/modules/common/sheeter/use-sheeter';
import { Button, SubmitButton } from '~/modules/ui/button';
import { Form } from '~/modules/ui/field';
import { useUpdateWorkspaceMutation } from '~/modules/workspace/query';

const formSchema = zUpdateWorkspaceBody;
type FormValues = z.infer<typeof formSchema>;
interface Props {
  workspace: Workspace;
  callback?: (workspace: Workspace) => void;
  dialog?: boolean;
  sheet?: boolean;
}

const UpdateWorkspaceForm = ({ workspace, callback, sheet: isSheet }: Props) => {
  const { t } = useTranslation();

  const { mutate, isPending } = useUpdateWorkspaceMutation();

  const formOptions: UseFormProps<FormValues> = {
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: workspace.name,
    },
  };

  const formContainerId = 'update-workspace';
  const form = useFormWithDraft<FormValues>(`update-workspace-${workspace.id}`, { formOptions, formContainerId });

  // Prevent data loss
  useBeforeUnload(form.isDirty);

  const onSubmit = (values: FormValues) => {
    mutate(
      {
        path: { id: workspace.id, organizationId: workspace.organizationId, tenantId: workspace.tenantId },
        body: values,
      },
      {
        onSuccess: (updatedWorkspace) => {
          if (isSheet) useSheeter.getState().remove('update-workspace');
          form.reset(updatedWorkspace);
          callback?.(updatedWorkspace);
        },
      },
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <InputFormField control={form.control} name="name" label={t('c:name')} required />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SubmitButton disabled={!form.isDirty} loading={isPending}>
            {t('c:save_changes')}
          </SubmitButton>
          <Button
            type="reset"
            variant="secondary"
            onClick={() => form.reset()}
            className={form.isDirty ? '' : 'invisible'}
          >
            {t('c:cancel')}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export { UpdateWorkspaceForm };
