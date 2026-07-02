import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { type UseFormProps, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zCreateProjectsBody } from 'sdk/zod.gen';
import { generateId } from 'shared/entity-id';
import { z } from 'zod';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { useFormWithDraft } from '~/modules/common/form-draft/use-draft-form';
import { InputFormField } from '~/modules/common/form-fields/input';
import { SlugFormField } from '~/modules/common/form-fields/slug';
import { useProjectCreateMutation } from '~/modules/project/query';
import { Button, SubmitButton } from '~/modules/ui/button';
import { Checkbox } from '~/modules/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '~/modules/ui/field';
import { useWorkspaceContext } from '~/modules/workspace/use-workspace-context';

const formSchema = zCreateProjectsBody.element.omit({ id: true }).extend({ workspaceId: z.string() });
type FormValues = z.infer<typeof formSchema>;
interface CreateProjectFormProps {
  callback?: () => void;
  dialog?: boolean;
}

export const CreateProjectForm = ({ dialog: isDialog }: CreateProjectFormProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { workspace } = useWorkspaceContext();

  const formOptions: UseFormProps<FormValues> = useMemo(
    () => ({
      resolver: zodResolver(formSchema),
      defaultValues: {
        name: '',
        slug: '',
        publicAt: null,
        workspaceId: workspace.id,
      },
    }),
    [],
  );

  // Form with draft in local storage
  const form = useFormWithDraft<FormValues>('create-project', { formOptions });

  // Watch to update slug field
  const name = useWatch({ control: form.control, name: 'name' });

  const { mutate: create, isPending } = useProjectCreateMutation();

  const onSubmit = (values: FormValues) => {
    const { workspaceId, ...itemBody } = values;
    create(
      {
        path: { organizationId: workspace.organizationId, tenantId: workspace.tenantId },
        body: [{ ...itemBody, id: `temp-${generateId()}` }],
        query: { workspaceId },
      },
      {
        onSuccess: async (createdProject) => {
          form.reset();
          if (isDialog) useDialoger.getState().remove();
          navigate({
            to: '.',
            params: true,
            resetScroll: false,
            search: (prev) => ({
              ...prev,
              projectSlug: createdProject.slug,
            }),
          });
        },
      },
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <InputFormField control={form.control} name="name" label={t('c:name')} required autoFocus />
        <SlugFormField
          control={form.control}
          entityType="project"
          tenantId={workspace.tenantId}
          label={t('c:resource_handle', { resource: t('c:project') })}
          description={t('c:resource_handle.text', { resource: t('c:project').toLowerCase() })}
          nameValue={name}
        />
        <FormField
          control={form.control}
          name="publicAt"
          render={({ field }) => (
            <FormItem className="flex-row items-center" name="publicAt">
              <FormControl>
                <Checkbox
                  checked={field.value !== null}
                  onCheckedChange={(checked) => field.onChange(checked ? new Date().toISOString() : null)}
                />
              </FormControl>
              <FormLabel>{t('c:public_access')}</FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SubmitButton disabled={!form.isDirty} loading={isPending}>
            {t('c:create')}
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
