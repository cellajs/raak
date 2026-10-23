import { type CSSProperties, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ComboboxSearchInput } from '~/modules/common/combobox-search-input';
import { dropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { ComboboxHotkeyHint, comboboxRowClass, HotkeyIndexBadge, matchDigitHotkey } from '~/modules/task/dropdowns/combobox-parts';
import type { SelectStatusProps } from '~/modules/task/dropdowns/types';
import { useTaskQuery } from '~/modules/task/hooks/use-task-query';
import { statusOptions, statusOptionsByValue } from '~/modules/task/task-properties';
import type { TaskStatusType } from '~/modules/task/types';
import { Combobox, ComboboxEmpty, ComboboxItem, ComboboxItemIndicator, ComboboxList } from '~/modules/ui/combobox';
import { isTouchInteraction } from '~/utils/input-modality';

type StatusOption = (typeof statusOptions)[number];

export function SelectStatus({ value: currentStatus, onChange, taskId, triggerWidth = 240 }: SelectStatusProps) {
  const { t } = useTranslation();

  // Live cache subscription reflects remote SSE status changes while open.
  const { data: liveTask } = useTaskQuery(taskId);
  const liveStatus = liveTask?.status ?? currentStatus;

  // Derived during render, without a useState/useEffect copy of liveStatus.
  const selectedStatus = liveStatus === undefined ? null : statusOptionsByValue[liveStatus];

  const [searchValue, setSearchValue] = useState('');

  const commit = (status: TaskStatusType) => {
    if (liveStatus !== status) onChange(status);
    setSearchValue('');
    dropdowner.getState().remove();
  };

  return (
    <Combobox<StatusOption>
      inline
      openOnInputClick={false}
      items={statusOptions}
      itemToStringLabel={(item) => t(`c:${item.status}`)}
      itemToStringValue={(item) => item.status}
      value={selectedStatus}
      onValueChange={(item) => {
        if (item) commit(item.value);
      }}
      inputValue={searchValue}
      onInputValueChange={(value) => {
        // Digit hotkey: 1-7 selects status by index
        const status = matchDigitHotkey(statusOptions, value, { max: 7 });
        if (status) {
          commit(status.value);
          return;
        }
        setSearchValue(value);
      }}
    >
      <div className="relative rounded-lg sm:w-(--trigger-width)" style={{ '--trigger-width': `${triggerWidth}px` } as CSSProperties}>
        <ComboboxSearchInput
          autoFocus={!isTouchInteraction()}
          value={searchValue}
          wrapClassName="max-sm:hidden"
          className="rounded-none leading-normal focus-visible:ring-transparent"
          placeholder={t('c:select_resource', { resource: t('c:status').toLowerCase() })}
          showClear={false}
        />
        <ComboboxHotkeyHint searching={!!searchValue.length}>S</ComboboxHotkeyHint>
        <ComboboxList>
          {(status: StatusOption) => {
            const index = statusOptions.findIndex((option) => option.value === status.value);
            return (
              <ComboboxItem key={status.value} value={status} className={comboboxRowClass}>
                <status.icon />
                <div className="grow">{t(`c:${status.status}`)}</div>
                <ComboboxItemIndicator className="text-success" />
                <HotkeyIndexBadge index={searchValue ? undefined : index} />
              </ComboboxItem>
            );
          }}
        </ComboboxList>
        <ComboboxEmpty>{t('c:no_resource_found', { resource: t('c:status').toLowerCase() })}</ComboboxEmpty>
      </div>
    </Combobox>
  );
}
