import { GlobeIcon } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '~/modules/ui/checkbox';
import { FieldContent, FieldDescription, FieldLabel, FieldLayout, FieldTitle } from '~/modules/ui/field';

interface PublicAccessCardProps {
  checked: boolean | undefined;
  onCheckedChange: (checked: boolean) => void;
}

/** The public access choice of the project forms. */
export function PublicAccessCard({ checked, onCheckedChange }: PublicAccessCardProps) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <FieldLabel htmlFor={id} card>
      <FieldLayout orientation="horizontal">
        <Checkbox id={id} checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
        <FieldContent>
          <FieldTitle>
            <GlobeIcon className="size-4 shrink-0" />
            {t('c:public_access')}
          </FieldTitle>
          <FieldDescription>{t('c:public_access.text')}</FieldDescription>
        </FieldContent>
      </FieldLayout>
    </FieldLabel>
  );
}
