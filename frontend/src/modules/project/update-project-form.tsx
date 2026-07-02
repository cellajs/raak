import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlertIcon } from 'lucide-react';
import type { UseFormProps } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { Project } from 'sdk';
import { zUpdateProjectBody } from 'sdk/zod.gen';
import type { z } from 'zod';
import { useBeforeUnload } from '~/hooks/use-before-unload';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { useFormWithDraft } from '~/modules/common/form-draft/use-draft-form';
import { AvatarFormField } from '~/modules/common/form-fields/avatar';
import { InputFormField } from '~/modules/common/form-fields/input';
import { SlugFormField } from '~/modules/common/form-fields/slug';
import { useSheeter } from '~/modules/common/sheeter/use-sheeter';
import { useProjectUpdateMutation } from '~/modules/project/query';
import { Button, SubmitButton } from '~/modules/ui/button';
import { Checkbox } from '~/modules/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '~/modules/ui/field';
import { cleanUrl } from '~/utils/clean-url';

const formSchema = zUpdateProjectBody;
type FormValues = z.infer<typeof formSchema>;
interface Props {
  project: Project;
  dialog?: boolean;
  sheet?: boolean;
  callback?: (project: Project) => void;
}

const UpdateProjectForm = ({ project, callback, dialog: isDialog, sheet: isSheet }: Props) => {
  const { t } = useTranslation();

  const organizationId = project.organizationId;

  const { mutate, isPending } = useProjectUpdateMutation();

  const formOptions: UseFormProps<FormValues> = {
    resolver: zodResolver(formSchema),
    defaultValues: {
      slug: project.slug,
      name: project.name,
      thumbnailUrl: cleanUrl(project.thumbnailUrl),
      publicAt: project.publicAt,
    },
  };

  const formContainerId = 'update-project';
  const form = useFormWithDraft<FormValues>(`update-project-${project.id}`, { formOptions, formContainerId });

  // Prevent data loss
  useBeforeUnload(form.isDirty);

  const onSubmit = (values: FormValues) => {
    mutate(
      {
        path: { id: project.id, organizationId, tenantId: project.tenantId },
        body: values,
      },
      {
        onSuccess: (updatedProject) => {
          if (isDialog) useDialoger.getState().remove();
          if (isSheet) useSheeter.getState().remove(formContainerId);
          form.reset(updatedProject);

          callback?.(updatedProject);
        },
      },
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <AvatarFormField
          form={form}
          label={t('c:resource_logo', { resource: t('c:project') })}
          type="project"
          name="thumbnailUrl"
          entity={project}
        />
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
              <p className="flex items-center gap-2">
                <CircleAlertIcon size={14} className="shrink-0 text-amber-500" />
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

export default UpdateProjectForm;
