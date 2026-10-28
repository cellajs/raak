import type { UseFormProps } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zChannelBase } from 'sdk/zod.gen';
import { z } from 'zod';
import { useFormWithDraft } from '~/modules/common/form-draft/use-draft-form';
import { CancelButton } from '~/modules/common/form-fields/cancel-button';
import { SubmitButton } from '~/modules/common/form-fields/submit-button';
import { useOverlayClose } from '~/modules/common/overlay-close';
import { toaster } from '~/modules/common/toaster/toaster';
import { ProjectSuggestionCombobox } from '~/modules/project/project-suggestion-combobox';
import { useProjectAssignMutation } from '~/modules/project/query';
import { Form, FormField, FormItem, FormLabel, FormMessage, RequiredMark } from '~/modules/ui/field';
import { useWorkspaceContext } from '~/modules/workspace/use-workspace-context';
import { formResolver } from '~/utils/form-resolver';

const formSchema = z.object({ selectedProjects: z.array(zChannelBase).min(1) });
type FormValues = z.infer<typeof formSchema>;

/** Lets users assign existing projects to the current workspace. */
export function SelectProjectForm() {
  const { t } = useTranslation();
  const overlay = useOverlayClose();
  const { workspace, organization } = useWorkspaceContext();

  const organizationId = workspace.organizationId;
  const workspaceId = workspace.id;

  const formOptions: UseFormProps<FormValues> = {
    resolver: formResolver(formSchema),
    defaultValues: { selectedProjects: [] },
  };

  const form = useFormWithDraft<FormValues>(`select-project-${workspaceId}`, { formOptions });

  const { mutateAsync: assign } = useProjectAssignMutation();

  const onSubmit = async ({ selectedProjects }: FormValues) => {
    const results = await Promise.allSettled(
      selectedProjects.map((project) =>
        assign({
          path: { id: project.id, organizationId, tenantId: workspace.tenantId },
          query: { workspaceId },
        }),
      ),
    );

    const assigned = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
    if (assigned.length === 1) {
      toaster.success(t('c:success.assign_resource', { resource: `${t('c:project')} ${assigned[0].name}`, secondResource: workspace.name }));
    } else if (assigned.length > 1) {
      toaster.success(
        t('c:success.assign_counted_resources', {
          count: assigned.length,
          resources: t('c:project_other').toLowerCase(),
          secondResource: workspace.name,
        }),
      );
    }

    form.reset();
    overlay?.close();
  };

  const selectedCount = useWatch({ control: form.control, name: 'selectedProjects' })?.length ?? 0;

  if (form.loading) return null;

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="selectedProjects"
          render={({ field: { value, onChange } }) => (
            <FormItem name="selectedProjects">
              <FormLabel>
                {t('c:project_other')}
                <RequiredMark />
              </FormLabel>
              <ProjectSuggestionCombobox
                value={value}
                onChange={onChange}
                workspaceId={workspace.id}
                tenantId={workspace.tenantId}
                organizationId={workspace.organizationId}
                organizationName={organization.name}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SubmitButton disabled={selectedCount === 0} loading={form.formState.isSubmitting}>
            {selectedCount > 0
              ? t('c:add_resource', { resource: `${selectedCount} ${t('c:project', { count: selectedCount }).toLowerCase()}` })
              : t('c:select')}
          </SubmitButton>
          <CancelButton dirty={selectedCount > 0} onClick={() => form.reset()} />
        </div>
      </form>
    </Form>
  );
}
