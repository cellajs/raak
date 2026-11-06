import i18n from 'i18next';
import { MailCheckIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zKeepSandboxBody } from 'sdk/zod.gen';
import type { z } from 'zod';
import { dialoger } from '~/modules/common/dialoger/use-dialoger';
import { FormActions } from '~/modules/common/form-fields/form-actions';
import { InputFormField } from '~/modules/common/form-fields/input';
import { SubmitButton } from '~/modules/common/form-fields/submit-button';
import { useSandboxKeepMutation } from '~/modules/sandbox/query';
import { Alert, AlertDescription, AlertTitle } from '~/modules/ui/alert';
import { Form } from '~/modules/ui/field';
import { formResolver } from '~/utils/form-resolver';

type FormValues = z.infer<typeof zKeepSandboxBody>;

/** Name, organization name and the address to keep the sandbox under; then where the link went. */
function KeepSandboxForm() {
  const { t } = useTranslation();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<FormValues>({ resolver: formResolver(zKeepSandboxBody), defaultValues: { firstName: '', email: '' } });
  const { mutate, isPending } = useSandboxKeepMutation();

  if (sentTo) {
    return (
      <Alert variant="info">
        <MailCheckIcon />
        <AlertTitle>{t('c:check_email')}</AlertTitle>
        <AlertDescription>{t('c:keep_sandbox_sent.text', { email: sentTo })}</AlertDescription>
      </Alert>
    );
  }

  const onSubmit = (values: FormValues) => mutate({ body: values }, { onSuccess: () => setSentTo(values.email) });

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <InputFormField control={form.control} name="firstName" label={t('c:first_name')} required />
          <InputFormField control={form.control} name="lastName" label={t('c:last_name')} />
        </div>
        <InputFormField control={form.control} name="email" type="email" label={t('c:email')} required />
        <InputFormField control={form.control} name="organizationName" label={t('c:organization_name')} placeholder={t('c:your_sandbox')} />
        <FormActions>
          <SubmitButton loading={isPending}>{t('c:keep_sandbox')}</SubmitButton>
        </FormActions>
      </form>
    </Form>
  );
}

/** Asks for the details that keep the sandbox. */
export const openKeepSandboxDialog = (triggerRef: { current: HTMLButtonElement | null }) =>
  dialoger.getState().create(<KeepSandboxForm />, {
    id: 'keep-sandbox',
    triggerRef,
    className: 'md:max-w-xl',
    title: i18n.t('c:keep_sandbox'),
    description: i18n.t('c:keep_sandbox.text'),
  });
