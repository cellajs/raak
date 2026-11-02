import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { UseFormProps } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ChannelBase, Organization, Workspace } from 'sdk';
import { zCreateWorkspacesBody, zCreateWorkspacesPath } from 'sdk/zod.gen';
import { generateId } from 'shared/utils/entity-id';
import { z } from 'zod';
import { useFormWithDraft } from '~/modules/common/form-draft/use-draft-form';
import { CancelButton } from '~/modules/common/form-fields/cancel-button';
import { FormActions } from '~/modules/common/form-fields/form-actions';
import { InputFormField } from '~/modules/common/form-fields/input';
import { SelectParentFormField } from '~/modules/common/form-fields/select-combobox/parent';
import { SubmitButton } from '~/modules/common/form-fields/submit-button';
import { NamedText } from '~/modules/common/named-text';
import { useOverlayClose } from '~/modules/common/overlay-close';
import { Spinner } from '~/modules/common/spinner';
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

const followOrganization = { shouldDirty: true, shouldValidate: true } as const;

const formContainerId = 'create-workspace';

const startingOrganization = (items: Organization[], organizationId?: string) =>
  organizationId ? items.find(({ id }) => id === organizationId) : items.length === 1 ? items[0] : undefined;

/** Names the organization the new workspace lands in, once that is settled. */
export function CreateWorkspaceDescription({ organizationId }: { organizationId?: string }) {
  const { t } = useTranslation();
  const query = useInfiniteQuery(organizationsListQueryOptions({}));
  const organization = startingOrganization(flattenInfiniteData<Organization>(query.data), organizationId);

  if (!organization) return t('c:create_workspace.text');
  return <NamedText i18nKey="c:create_workspace_in.text" name={organization.name} />;
}

interface CreateWorkspaceFormProps {
  /** The organization it starts from; without one, and with several to choose from, the form asks. */
  organizationId?: string;
  callback?: (workspace: Workspace) => void;
}

/** Resolves the organization a new workspace starts in (preselected, sole, or just created) before the form mounts. */
export function CreateWorkspaceForm({ organizationId, callback }: CreateWorkspaceFormProps) {
  const { t } = useTranslation();
  const [createdOrganization, setCreatedOrganization] = useState<Organization>();

  const query = useInfiniteQuery(organizationsListQueryOptions({}));
  const items = flattenInfiniteData<Organization>(query.data);

  if (query.isLoading) return <Spinner className="my-8" />;

  const organization = createdOrganization ?? startingOrganization(items, organizationId);

  if (!organization && !items.length)
    return (
      <Alert variant="plain" className="w-auto">
        <AlertTitle>{t('c:resource_required', { resource: t('c:organization') })}</AlertTitle>
        <AlertDescription className="pr-8">
          <p className="mb-2">{t('c:organization_required.text')}</p>
          <Button onClick={() => openCreateOrganizationDialog({ current: null }, setCreatedOrganization)}>
            <span>{t('c:create_resource', { resource: t('c:organization') })}</span>
          </Button>
        </AlertDescription>
      </Alert>
    );

  return <WorkspaceForm organization={organization} organizations={items} callback={callback} />;
}

interface WorkspaceFormProps {
  organization?: Organization;
  organizations: Organization[];
  callback?: (workspace: Workspace) => void;
}

function WorkspaceForm({ organization, organizations, callback }: WorkspaceFormProps) {
  const { t } = useTranslation();
  const overlay = useOverlayClose();

  // The starting organization and its name are the pristine state, so a reset returns to them
  const formOptions: UseFormProps<FormValues> = {
    resolver: formResolver(formSchema),
    defaultValues: { name: organization?.name ?? '', organizationId: organization?.id ?? '', tenantId: organization?.tenantId ?? '' },
  };

  // A draft carries its organizationId: under one shared key it would silently create in another organization while the field is hidden
  const form = useFormWithDraft<FormValues>(organization ? `${formContainerId}-${organization.id}` : formContainerId, {
    formOptions,
    formContainerId,
  });

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

  // A name that still reads as an organization's (or is empty) follows the pick; a typed one stays
  const handleOrganizationSelect = (selectedOrg: ChannelBase) => {
    const name = form.getValues('name');
    form.setValue('tenantId', selectedOrg.tenantId, followOrganization);
    if (!name || organizations.some((org) => org.name === name)) form.setValue('name', selectedOrg.name, followOrganization);
  };

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {!organization && (
          <SelectParentFormField
            parentType="organization"
            control={form.control}
            label={t('c:organization')}
            name="organizationId"
            onSelect={handleOrganizationSelect}
            required
          />
        )}

        <InputFormField control={form.control} name="name" label={t('c:name')} required />

        <FormActions>
          <SubmitButton loading={isPending}>{t('c:create')}</SubmitButton>
          <CancelButton dirty={form.isDirty} onClick={() => form.reset()} />
        </FormActions>
      </form>
    </Form>
  );
}
