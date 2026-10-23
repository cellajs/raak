import { TagIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LocalPanelShell } from '~/modules/common/board/local-panel-shell';
// LabelList is eagerly imported (not lazy): the panel is always present on the board, so a separate
// chunk would only make labels render a round-trip after tasks.
import { LabelList } from '~/modules/label/label-list';
import type { LabelsHostProps, LabelsScopeProps } from '~/modules/label/types';
import { LABELS_PANEL_ID } from '~/modules/label/types';

interface LabelsPanelProps extends LabelsScopeProps, Pick<LabelsHostProps, 'windowScroll'> {}

/**
 * Always-present board panel hosting the labels list (secondary tags + epics).
 * Collapsible, resizable and movable like other panels; defaults to the end of the board.
 */
export function LabelsPanel({ entity, entityId, windowScroll }: LabelsPanelProps) {
  const { t } = useTranslation();

  return (
    <LocalPanelShell panelId={LABELS_PANEL_ID} icon={<TagIcon />} title={t('c:label_other').toLowerCase()} windowScroll={windowScroll}>
      <LabelList entity={entity} entityId={entityId} windowScroll={windowScroll} navPanelId={LABELS_PANEL_ID} />
    </LocalPanelShell>
  );
}
