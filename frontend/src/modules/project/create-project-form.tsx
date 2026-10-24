import { type UseFormProps, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zCreateProjectsBody } from 'sdk/zod.gen';
import { generateId } from 'shared/utils/entity-id';
import type { z } from 'zod';
import { useFormWithDraft } from '~/modules/common/form-draft/use-draft-form';
import { CancelButton } from '~/modules/common/form-fields/cancel-button';
import { InputFormField } from '~/modules/common/form-fields/input';
import { SlugFormField } from '~/modules/common/form-fields/slug';
import { SubmitButton } from '~/modules/common/form-fields/submit-button';
import { useOverlayClose } from '~/modules/common/overlay-close';
import { toaster } from '~/modules/common/toaster/toaster';
import { useProjectCreateMutation } from '~/modules/project/query';
import { selectBoardProject } from '~/modules/task/helpers/board-navigation';
import { Checkbox } from '~/modules/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '~/modules/ui/field';
import { useWorkspaceContext } from '~/modules/workspace/use-workspace-context';
import { formResolver } from '~/utils/form-resolver';

const formSchema = zCreateProjectsBody.element.omit({ id: true });
type FormValues = z.infer<typeof formSchema>;
export function CreateProjectForm() {
  const { t } = useTranslation();
  const overlay = useOverlayClose();

  const { workspace } = useWorkspaceContext();

  const formOptions: UseFormProps<FormValues> = { resolver: formResolver(formSchema), defaultValues: { name: '', slug: '', public: false } };

  const form = useFormWithDraft<FormValues>('create-project', { formOptions });

  const name = useWatch({ control: form.control, name: 'name' });

  const { mutate: create, isPending } = useProjectCreateMutation();

  const onSubmit = (values: FormValues) => {
    create(
      {
        path: { organizationId: workspace.organizationId, tenantId: workspace.tenantId },
        body: [{ ...values, id: `temp-${generateId()}` }],
        query: { workspaceId: workspace.id },
      },
      {
        onSuccess: (createdProject) => {
          toaster.success(t('c:success.create_resource', { resource: t('c:project') }));
          form.reset();
          overlay?.close();
          selectBoardProject(createdProject.slug);
        },
      },
    );
  };

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
          name="public"
          render={({ field }) => (
            <FormItem className="flex-row items-center" name="public">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
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
          <CancelButton dirty={form.isDirty} onClick={() => form.reset()} />
        </div>
      </form>
    </Form>
  );
}
