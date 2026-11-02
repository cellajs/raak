import type { UseFormProps } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { Project } from 'sdk';
import { zUpdateProjectBody } from 'sdk/zod.gen';
import type { z } from 'zod';
import { useBeforeUnload } from '~/hooks/use-before-unload';
import { useFormWithDraft } from '~/modules/common/form-draft/use-draft-form';
import { AvatarFormField } from '~/modules/common/form-fields/avatar';
import { CancelButton } from '~/modules/common/form-fields/cancel-button';
import { FormActions } from '~/modules/common/form-fields/form-actions';
import { InputFormField } from '~/modules/common/form-fields/input';
import { SlugFormField } from '~/modules/common/form-fields/slug';
import { SubmitButton } from '~/modules/common/form-fields/submit-button';
import { sheeter } from '~/modules/common/sheeter/use-sheeter';
import { toaster } from '~/modules/common/toaster/toaster';
import { PublicAccessCard } from '~/modules/project/public-access-card';
import { useProjectUpdateMutation } from '~/modules/project/query';
import { Form, FormField, FormItem, FormMessage } from '~/modules/ui/field';
import { cleanUrl } from '~/utils/clean-url';
import { formResolver } from '~/utils/form-resolver';

const formSchema = zUpdateProjectBody;
type FormValues = z.infer<typeof formSchema>;
interface UpdateProjectFormProps {
  project: Project;
}

export function UpdateProjectForm({ project }: UpdateProjectFormProps) {
  const { t } = useTranslation();

  const organizationId = project.organizationId;

  const { mutate, isPending } = useProjectUpdateMutation();

  const formOptions: UseFormProps<FormValues> = {
    resolver: formResolver(formSchema),
    defaultValues: { slug: project.slug, name: project.name, thumbnailUrl: cleanUrl(project.thumbnailUrl), public: project.public },
  };

  const formContainerId = 'update-project';
  const form = useFormWithDraft<FormValues>(`update-project-${project.id}`, { formOptions, formContainerId });

  useBeforeUnload(form.isDirty);

  const onSubmit = (values: FormValues) => {
    mutate(
      { path: { id: project.id, organizationId, tenantId: project.tenantId }, body: values },
      {
        onSuccess: (updatedProject) => {
          sheeter.getState().remove(formContainerId);
          form.reset(updatedProject);
          toaster.success(t('c:success.update_resource', { resource: t('c:project') }));
        },
      },
    );
  };

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <AvatarFormField
          form={form}
          label={t('c:resource_logo', { resource: t('c:project') })}
          type="project"
          name="thumbnailUrl"
          entity={project}
          organizationId={project.organizationId}
        />
        <InputFormField control={form.control} name="name" label={t('c:name')} required />
        <SlugFormField
          control={form.control}
          entityType="project"
          tenantId={project.tenantId}
          label={t('c:resource_handle', { resource: t('c:project') })}
          description={t('c:resource_handle.text')}
          previousSlug={project.slug}
        />
        <FormField
          control={form.control}
          name="public"
          render={({ field }) => (
            <FormItem name="public">
              <PublicAccessCard checked={field.value} onCheckedChange={field.onChange} />
              <FormMessage />
            </FormItem>
          )}
        />
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
