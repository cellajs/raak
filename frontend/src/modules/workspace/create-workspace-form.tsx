import { zodResolver } from '@hookform/resolvers/zod';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { type UseFormProps, useFormState, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ChannelEntityBase, Organization, Workspace } from 'sdk';
import { zCreateWorkspacesBody, zCreateWorkspacesPath } from 'sdk/zod.gen';
import { generateId } from 'shared/utils/entity-id';
import { z } from 'zod';
import type { CallbackArgs } from '~/modules/common/data-table/types';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { useFormWithDraft } from '~/modules/common/form-draft/use-draft-form';
import { InputFormField } from '~/modules/common/form-fields/input';
import { SelectParentFormField } from '~/modules/common/form-fields/select-combobox/parent';
import { CreateOrganizationForm } from '~/modules/organization/create-organization-form';
import { Alert, AlertDescription, AlertTitle } from '~/modules/ui/alert';
import { Button, SubmitButton } from '~/modules/ui/button';
import { Form } from '~/modules/ui/field';
import { useWorkspaceCreateMutation } from '~/modules/workspace/query';
import { flattenInfiniteData } from '~/query/basic/flatten';
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
interface CreateWorkspaceFormProps {
  dialog?: boolean;
  callback?: (workspace: Workspace) => void;
}

const CreateWorkspaceForm = ({ callback, dialog: isDialog }: CreateWorkspaceFormProps) => {
  const { t } = useTranslation();

  const query = useInfiniteQuery(organizationsListQueryOptions({}));
  const items = flattenInfiniteData<Organization>(query.data);

  const formOptions: UseFormProps<FormValues> = useMemo(() => {
    return {
      mode: 'onTouched',
      resolver: zodResolver(formSchema),
      defaultValues: { name: '', organizationId: '', tenantId: '' },
    };
  }, []);

  // Form with draft in local storage
  const form = useFormWithDraft<FormValues>('create-workspace', { formOptions });

  const organizationId = useWatch({
    control: form.control,
    name: 'organizationId',
  });
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
          form.reset();
          if (isDialog) useDialoger.getState().remove();

          callback?.(createdWorkspace);
        },
      },
    );
  };

  const organizationCreated = (args: CallbackArgs<Organization>) => {
    if (args.status === 'success') {
      form.setValue('organizationId', args.data.id, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: true,
      });
      form.setValue('tenantId', args.data.tenantId, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: true,
      });

      const currentName = form.getValues('name');
      if (!touchedFields.name && !currentName) {
        form.setValue('name', args.data.name, {
          shouldDirty: false,
          shouldTouch: false,
          shouldValidate: true,
        });
      }
    }
  };

  const onOrganizationSelect = useCallback(
    (selectedOrg: ChannelEntityBase) => {
      form.setValue('tenantId', selectedOrg.tenantId, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: true,
      });

      const currentName = form.getValues('name');
      if (!touchedFields.name && !currentName) {
        form.setValue('name', selectedOrg.name, {
          shouldDirty: false,
          shouldTouch: false,
          shouldValidate: true,
        });
      }
    },
    [form, touchedFields.name],
  );

  // Async queries mean single-org defaults are not available at first render.
  useEffect(() => {
    if (items.length !== 1 || organizationId) return;

    const selectedOrg = items[0];
    form.setValue('organizationId', selectedOrg.id, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: true,
    });
    onOrganizationSelect(selectedOrg);
  }, [items, organizationId, form, onOrganizationSelect]);

  // Alert if no organizations exist (wait for query to finish loading first)
  if (!query.isLoading && !form.getValues('organizationId') && !items.length)
    return (
      <Alert variant="plain" className="w-auto">
        <AlertTitle>{t('c:resource_required', { resource: t('c:organization') })}</AlertTitle>
        <AlertDescription className="pr-8">
          <p className="mb-2">{t('c:organization_required.text')}</p>
          <Button
            onClick={() => {
              useDialoger.getState().create(<CreateOrganizationForm callback={organizationCreated} dialog />, {
                triggerRef: { current: null },
                className: 'md:max-w-2xl',
                id: 'create-organization',
                title: t('c:create_resource', { resource: t('c:organization').toLowerCase() }),
              });
            }}
          >
            <span>{t('c:create_resource', { resource: t('c:organization').toLowerCase() })}</span>
          </Button>
        </AlertDescription>
      </Alert>
    );

  const isSingleOrg = items.length === 1;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

export { CreateWorkspaceForm };
