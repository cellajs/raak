import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { type SectionsValue, useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { statusOptions } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';
import { Button } from '~/modules/ui/button';
import { Checkbox } from '~/modules/ui/checkbox';

export const SplitProjectPanelDialog = ({
  boardId,
  projectId,
  panelsSectionView,
}: {
  boardId: string;
  projectId: string;
  panelsSectionView?: SectionsValue[];
}) => {
  const { t } = useTranslation();
  const setPanelSections = useTaskBoardStore((state) => state.setPanelSections);

  const mainPanelStatuses = panelsSectionView?.[0]?.status ?? statusOptions.map(({ value }) => value);

  // Only show statuses in the main panel
  const availableStatuses = statusOptions.filter(({ value }) => mainPanelStatuses.includes(value));

  const [selectedStatuses, setSelectedStatuses] = useState<Task['status'][]>([]);

  // Toggle selection
  const toggleStatus = (value: Task['status']) => {
    setSelectedStatuses((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  // Confirm: move selected out of main panel into a new panel
  const handleConfirm = () => {
    if (!selectedStatuses.length) return;

    const newMainPanel: SectionsValue = {
      status: mainPanelStatuses.filter((s) => !selectedStatuses.includes(s)),
    };

    const newSelectedPanel: SectionsValue = { status: [...selectedStatuses] };
    const restPanels = panelsSectionView?.slice(1) ?? [];

    setPanelSections(boardId, projectId, [newMainPanel, newSelectedPanel, ...restPanels]);
    setSelectedStatuses([]);
    useDialoger.getState().remove();
  };

  // Clear selections or close dialog
  const handleClearOrClose = () => {
    if (selectedStatuses.length) setSelectedStatuses([]);
    else useDialoger.getState().remove();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {availableStatuses.map(({ status, value }) => (
          // biome-ignore lint/a11y/noLabelWithoutControl: <Checkbox /> renders the underlying input control.
          <label key={value} className="flex items-center gap-2">
            <Checkbox checked={selectedStatuses.includes(value)} onCheckedChange={() => toggleStatus(value)} />
            <span>{status}</span>
          </label>
        ))}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={handleClearOrClose}>
          {selectedStatuses.length ? t('c:clear') : t('c:close')}
        </Button>
        <Button disabled={!selectedStatuses.length || availableStatuses.length <= 1} onClick={handleConfirm}>
          {t('c:confirm')}
        </Button>
      </div>
    </div>
  );
};
