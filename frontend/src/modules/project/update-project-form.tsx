import { CircleAlertIcon } from 'lucide-react';
import type { UseFormProps } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { Project } from 'sdk';
import { zUpdateProjectBody } from 'sdk/zod.gen';
import type { z } from 'zod';
import { useBeforeUnload } from '~/hooks/use-before-unload';
import { useFormWithDraft } from '~/modules/common/form-draft/use-draft-form';
import { AvatarFormField } from '~/modules/common/form-fields/avatar';
import { CancelButton } from '~/modules/common/form-fields/cancel-button';
import { InputFormField } from '~/modules/common/form-fields/input';
import { SlugFormField } from '~/modules/common/form-fields/slug';
import { SubmitButton } from '~/modules/common/form-fields/submit-button';
import { sheeter } from '~/modules/common/sheeter/use-sheeter';
import { toaster } from '~/modules/common/toaster/toaster';
import { useProjectUpdateMutation } from '~/modules/project/query';
import { Checkbox } from '~/modules/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '~/modules/ui/field';
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
        <AvatarFormField form={form} label={t('c:resource_logo', { resource: t('c:project') })} type="project" name="thumbnailUrl" entity={project} />
        <InputFormField control={form.control} name="name" label={t('c:name')} required />
        <SlugFormField
          control={form.control}
          entityType="project"
          tenantId={project.tenantId}
          label={t('c:resource_handle', { resource: t('c:project') })}
          description={t('c:resource_handle.text', { resource: t('c:project').toLowerCase() })}
          previousSlug={project.slug}
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
              <p className="flex items-center gap-2">
                <CircleAlertIcon className="size-3.5 shrink-0 text-amber-500" />
                <span className="text-muted-foreground text-sm">{t('c:public_access_warn.text')}</span>
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
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
