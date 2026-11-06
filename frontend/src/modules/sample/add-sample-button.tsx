import { SparklesIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOrganizationLayoutContext } from '~/hooks/use-organization-layout-context';
import { useSampleProvisionMutation } from '~/modules/sample/query';
import { Button } from '~/modules/ui/button';

interface AddSampleButtonProps {
  /** The workspace the sample projects go into for the caller. */
  workspaceId: string;
}

/** Puts the sample projects on the board, for a team that has nothing to try the product on yet. */
export function AddSampleButton({ workspaceId }: AddSampleButtonProps) {
  const { t } = useTranslation();
  const { organizationId, tenantId } = useOrganizationLayoutContext();
  const { mutate, isPending } = useSampleProvisionMutation();

  return (
    <Button variant="secondary" loading={isPending} onClick={() => mutate({ path: { tenantId, organizationId }, query: { workspaceId } })}>
      <SparklesIcon />
      <span>{t('c:add_sample')}</span>
    </Button>
  );
}
