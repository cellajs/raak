import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { type UseFormProps, useFormState, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ChannelBase, Organization, Workspace } from 'sdk';
import { zCreateWorkspacesBody, zCreateWorkspacesPath } from 'sdk/zod.gen';
import { generateId } from 'shared/utils/entity-id';
import { z } from 'zod';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { useFormWithDraft } from '~/modules/common/form-draft/use-draft-form';
import { CancelButton } from '~/modules/common/form-fields/cancel-button';
import { InputFormField } from '~/modules/common/form-fields/input';
import { SelectParentFormField } from '~/modules/common/form-fields/select-combobox/parent';
import { SubmitButton } from '~/modules/common/form-fields/submit-button';
import { toaster } from '~/modules/common/toaster/toaster';
import { openCreateOrganizationDialog } from '~/modules/organization/create-organization-form';
import { Alert, AlertDescription, AlertTitle } from '~/modules/ui/alert';
import { Button } from '~/modules/ui/button';
import { Form } from '~/modules/ui/field';
import { useWorkspaceCreateMutation } from '~/modules/workspace/query';
import { flattenInfiniteData } from '~/query/basic/flatten';
import { formResolver } from '~/utils/form-resolver';
import { organizationsListQueryOptions } from '../organization/query';

const formSchema = z.object({
  ...zCreateWorkspacesBody.element.omit({ id: true }).shape,
  ...zCreateWorkspacesPath.shape,
  // Generated path schema only checks max length; require a selection so
  // `isValid` correctly disables submit and FormMessage surfaces the error.
  organizationId: z.string().min(1),
  tenantId: z.string().min(1),
});
type FormValues = z.infer<typeof formSchema>;

// Programmatic field writes (org/tenant/name defaults) must not mark the form dirty or touched,
// but still revalidate so `isValid` stays accurate.
const keepPristine = { shouldDirty: false, shouldTouch: false, shouldValidate: true } as const;

interface CreateWorkspaceFormProps {
  callback?: (workspace: Workspace) => void;
}

function CreateWorkspaceForm({ callback }: CreateWorkspaceFormProps) {
  const { t } = useTranslation();

  const query = useInfiniteQuery(organizationsListQueryOptions({}));
  const items = flattenInfiniteData<Organization>(query.data);

  const formOptions: UseFormProps<FormValues> = {
    mode: 'onTouched',
    resolver: formResolver(formSchema),
    defaultValues: { name: '', organizationId: '', tenantId: '' },
  };

  // Form with draft in local storage
  const form = useFormWithDraft<FormValues>('create-workspace', { formOptions });

  const organizationId = useWatch({ control: form.control, name: 'organizationId' });
  const { touchedFields, isValid } = useFormState({ control: form.control, name: ['name'] });

  const { mutate: create, isPending } = useWorkspaceCreateMutation();

  const onSubmit = (values: FormValues) => {
    create(
      {
        path: { organizationId: values.organizationId, tenantId: values.tenantId },
        body: [{ id: `temp-${generateId()}`, name: values.name }],
      },
      {
        onSuccess: (createdWorkspace) => {
          toaster.success(t('c:success.create_resource', { resource: t('c:workspace') }));
          form.reset();
          useDialoger.getState().remove();

          callback?.(createdWorkspace);
        },
      },
    );
  };

  const onOrganizationSelect = useCallback(
    (selectedOrg: ChannelBase) => {
      form.setValue('tenantId', selectedOrg.tenantId, keepPristine);

      const currentName = form.getValues('name');
      if (!touchedFields.name && !currentName) {
        form.setValue('name', selectedOrg.name, keepPristine);
      }
    },
    [form.setValue, form.getValues, touchedFields.name],
  );

  const organizationCreated = (organization: Organization) => {
    form.setValue('organizationId', organization.id, keepPristine);
    onOrganizationSelect(organization);
  };

  // Async queries mean single-org defaults are not available at first render.
  useEffect(() => {
    if (items.length !== 1 || organizationId) return;

    const selectedOrg = items[0];
    form.setValue('organizationId', selectedOrg.id, keepPristine);
    onOrganizationSelect(selectedOrg);
  }, [items, organizationId, form.setValue, onOrganizationSelect]);

  // Alert if no organizations exist (wait for query to finish loading first)
  if (!query.isLoading && !organizationId && !items.length)
    return (
      <Alert variant="plain" className="w-auto">
        <AlertTitle>{t('c:resource_required', { resource: t('c:organization') })}</AlertTitle>
        <AlertDescription className="pr-8">
          <p className="mb-2">{t('c:organization_required.text')}</p>
          <Button onClick={() => openCreateOrganizationDialog({ current: null }, organizationCreated)}>
            <span>{t('c:create_resource', { resource: t('c:organization').toLowerCase() })}</span>
          </Button>
        </AlertDescription>
      </Alert>
    );

  const isSingleOrg = items.length === 1;

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <SelectParentFormField
          parentType="organization"
          control={form.control}
          label={t('c:organization')}
          name="organizationId"
          onSelect={onOrganizationSelect}
          required
          disabled={isSingleOrg}
        />

        <InputFormField control={form.control} name="name" label={t('c:name')} required />

        <div className="flex flex-col gap-2 sm:flex-row">
          <SubmitButton disabled={!isValid} loading={isPending}>
            {t('c:create')}
          </SubmitButton>
          <CancelButton dirty={form.isDirty} onClick={() => form.reset()} />
        </div>
      </form>
    </Form>
  );
}

export { CreateWorkspaceForm };
