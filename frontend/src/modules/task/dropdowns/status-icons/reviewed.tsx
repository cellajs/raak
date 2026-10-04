import type { SVGProps } from 'react';
import { useTranslation } from 'react-i18next';
import { STATUS_ICON_STROKE_WIDTH } from '~/modules/task/dropdowns/status-icons/constants';

export function ReviewedIcon({ ...props }: SVGProps<SVGSVGElement>) {
  const { t } = useTranslation();
  return (
    <svg width="1em" height="1em" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-label={t('c:reviewed')} {...props}>
      <title>{t('c:reviewed')}</title>
      <rect x="1.25" y="1.25" width="13.5" height="13.5" rx="4.25" fill="none" stroke="#f97316" strokeWidth={STATUS_ICON_STROKE_WIDTH} />
      <rect x="3.2" y="3.2" width="9.6" height="9.6" rx="3.15" fill="#f97316" />
    </svg>
  );
}
