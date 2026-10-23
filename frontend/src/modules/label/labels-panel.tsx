import { TagIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LocalPanelShell } from '~/modules/common/board/local-panel-shell';
// Imported eagerly: the panel is always on the board, so a separate chunk would only delay labels behind tasks
import { LabelList } from '~/modules/label/label-list';
import { LABELS_PANEL_ID, type LabelsHostProps, type LabelsScopeProps } from '~/modules/label/types';

interface LabelsPanelProps extends LabelsScopeProps, Pick<LabelsHostProps, 'windowScroll'> {}

/** Always-present board panel hosting the labels list, collapsible, resizable and movable like the other panels. */
export function LabelsPanel({ entity, entityId, windowScroll }: LabelsPanelProps) {
  const { t } = useTranslation();

  return (
    <LocalPanelShell panelId={LABELS_PANEL_ID} icon={<TagIcon />} title={t('c:label_other').toLowerCase()} windowScroll={windowScroll}>
      <LabelList entity={entity} entityId={entityId} windowScroll={windowScroll} navPanelId={LABELS_PANEL_ID} />
    </LocalPanelShell>
  );
}
