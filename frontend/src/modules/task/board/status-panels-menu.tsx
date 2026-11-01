import { useTranslation } from 'react-i18next';
import { useBoardStore } from '~/modules/common/board/board-store';
import { ViewMenu } from '~/modules/common/data-table/view-menu';
import { DropdownActionGroup, DropdownActionSeparator } from '~/modules/common/dropdowner/dropdown-action-item';
import { DropdownSegmented } from '~/modules/common/dropdowner/dropdown-segmented';
import { DropdownToggleItem } from '~/modules/common/dropdowner/dropdown-toggle-item';
import { LABELS_PANEL_ID } from '~/modules/label/types';
import { type TogglableStatusType, useStartWith, useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { statusesBottomUp } from '~/modules/task/helpers/board-helpers';
import { statusOptionsByValue } from '~/modules/task/task-properties';

const statusRows = statusesBottomUp.toReversed();

interface StatusPanelsMenuProps {
  boardId: string;
  className?: string;
}

/** The board's view menu, in the table's place: which end of the workflow the status panels start with, and the statuses that get a panel of their own. */
export function StatusPanelsMenu({ boardId, className }: StatusPanelsMenuProps) {
  const { t } = useTranslation();
  const statusPanels = useTaskBoardStore((state) => state.statusPanels[boardId]);
  const toggleStatusPanel = useTaskBoardStore((state) => state.toggleStatusPanel);
  const startWith = useStartWith(boardId);
  const setStartWith = useTaskBoardStore((state) => state.setStartWith);
  const prunePanelOrders = useBoardStore((state) => state.prunePanelOrders);

  const changeStartWith = (status: TogglableStatusType) => {
    setStartWith(boardId, status);
    // A dragged status panel's stored place means nothing in the new order
    prunePanelOrders(boardId, [LABELS_PANEL_ID]);
  };

  return (
    <ViewMenu className={className}>
      <DropdownActionGroup label={t('c:start_with')}>
        <DropdownSegmented<TogglableStatusType>
          label={t('c:start_with')}
          value={startWith}
          onChange={changeStartWith}
          options={[
            { value: 'iced', label: t('c:iced') },
            { value: 'accepted', label: t('c:accepted') },
          ]}
        />
      </DropdownActionGroup>
      <DropdownActionSeparator />
      <DropdownActionGroup label={t('c:status_panels')}>
        {statusRows.map((status) => {
          const { icon, status: name } = statusOptionsByValue[status];
          return (
            <DropdownToggleItem
              key={status}
              icon={icon}
              checked={!!statusPanels?.includes(status)}
              onCheckedChange={() => toggleStatusPanel(boardId, status)}
            >
              {t(`c:${name}`)}
            </DropdownToggleItem>
          );
        })}
      </DropdownActionGroup>
    </ViewMenu>
  );
}
