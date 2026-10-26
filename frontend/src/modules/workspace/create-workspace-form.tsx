import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { type UseFormProps, useFormState, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ChannelBase, Organization, Workspace } from 'sdk';
import { zCreateWorkspacesBody, zCreateWorkspacesPath } from 'sdk/zod.gen';
import { generateId } from 'shared/utils/entity-id';
import { z } from 'zod';
import { useFormWithDraft } from '~/modules/common/form-draft/use-draft-form';
import { CancelButton } from '~/modules/common/form-fields/cancel-button';
import { InputFormField } from '~/modules/common/form-fields/input';
import { SelectParentFormField } from '~/modules/common/form-fields/select-combobox/parent';
import { SubmitButton } from '~/modules/common/form-fields/submit-button';
import { useOverlayClose } from '~/modules/common/overlay-close';
import { toaster } from '~/modules/common/toaster/toaster';
import { openCreateOrganizationDialog } from '~/modules/organization/create-organization-form';
import { organizationsListQueryOptions } from '~/modules/organization/query';
import { Alert, AlertDescription, AlertTitle } from '~/modules/ui/alert';
import { Button } from '~/modules/ui/button';
import { Form } from '~/modules/ui/field';
import { useWorkspaceCreateMutation } from '~/modules/workspace/query';
import { flattenInfiniteData } from '~/query/basic/flatten';
import { formResolver } from '~/utils/form-resolver';

const formSchema = z.object({
  ...zCreateWorkspacesBody.element.omit({ id: true }).shape,
  ...zCreateWorkspacesPath.shape,
  // The generated path schema only checks max length. tenantId has no input: the organization sets it.
  organizationId: z.string().min(1),
});
type FormValues = z.infer<typeof formSchema>;

// Programmatic field writes (org/tenant/name defaults) must not mark the form dirty or touched; validating clears
// the error a refused submit left on the field.
const keepPristine = { shouldDirty: false, shouldTouch: false, shouldValidate: true } as const;

interface CreateWorkspaceFormProps {
  /** Preselected organization; a restored draft keeps its own. */
  organizationId?: string;
  callback?: (workspace: Workspace) => void;
}

export function CreateWorkspaceForm({ organizationId: initialOrganizationId, callback }: CreateWorkspaceFormProps) {
  const { t } = useTranslation();
  const overlay = useOverlayClose();

  const query = useInfiniteQuery(organizationsListQueryOptions({}));
  const items = flattenInfiniteData<Organization>(query.data);

  const formOptions: UseFormProps<FormValues> = {
    resolver: formResolver(formSchema),
    defaultValues: { name: '', organizationId: initialOrganizationId ?? '', tenantId: '' },
  };

  const form = useFormWithDraft<FormValues>('create-workspace', { formOptions });

  const organizationId = useWatch({ control: form.control, name: 'organizationId' });
  const { touchedFields } = useFormState({ control: form.control, name: ['name'] });

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
          overlay?.close();

          callback?.(createdWorkspace);
        },
      },
    );
  };

  const handleOrganizationSelect = (selectedOrg: ChannelBase) => {
    form.setValue('tenantId', selectedOrg.tenantId, keepPristine);

    const currentName = form.getValues('name');
    if (!touchedFields.name && !currentName) {
      form.setValue('name', selectedOrg.name, keepPristine);
    }
  };

  const handleOrganizationCreated = (organization: Organization) => {
    form.setValue('organizationId', organization.id, keepPristine);
    handleOrganizationSelect(organization);
  };

  // The hidden tenantId follows the organization once the list loads: the sole one, or one a draft restored
  useEffect(() => {
    const selectedOrg = organizationId ? items.find(({ id }) => id === organizationId) : items.length === 1 ? items[0] : undefined;
    if (!selectedOrg || form.getValues('tenantId') === selectedOrg.tenantId) return;

    if (!organizationId) form.setValue('organizationId', selectedOrg.id, keepPristine);
    handleOrganizationSelect(selectedOrg);
  }, [items, organizationId, form.setValue, form.getValues, handleOrganizationSelect]);

  if (!query.isLoading && !organizationId && !items.length)
    return (
      <Alert variant="plain" className="w-auto">
        <AlertTitle>{t('c:resource_required', { resource: t('c:organization') })}</AlertTitle>
        <AlertDescription className="pr-8">
          <p className="mb-2">{t('c:organization_required.text')}</p>
          <Button onClick={() => openCreateOrganizationDialog({ current: null }, handleOrganizationCreated)}>
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
          onSelect={handleOrganizationSelect}
          required
          disabled={isSingleOrg}
        />

        <InputFormField control={form.control} name="name" label={t('c:name')} required />

        <div className="flex flex-col gap-2 sm:flex-row">
          <SubmitButton loading={isPending}>{t('c:create')}</SubmitButton>
          <CancelButton dirty={form.isDirty} onClick={() => form.reset()} />
        </div>
      </form>
    </Form>
  );
}
