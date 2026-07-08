import { type CSSProperties, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import type { SelectStatusProps } from '~/modules/task/dropdowns/types';
import { useTaskQuery } from '~/modules/task/hooks/use-task-query';
import { statusOptions, statusOptionsByValue } from '~/modules/task/task-properties';
import { statusFillColors } from '~/modules/task/task-styles';
import type { TaskStatusType } from '~/modules/task/types';
import {
  Combobox,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxSearchInput,
} from '~/modules/ui/combobox';
import { Kbd } from '~/modules/ui/kbd';
import { inNumbersArray } from '~/utils/in-numbers-array';

type StatusOption = (typeof statusOptions)[number];

export const SelectStatus = ({ value: currentStatus, onChange, taskId, triggerWidth = 240 }: SelectStatusProps) => {
  const { t } = useTranslation();

  // Live cache subscription — reflects remote SSE status changes while open.
  const { data: liveTask } = useTaskQuery(taskId);
  const liveStatus = liveTask?.status ?? currentStatus;

  // Derived during render — no useState/useEffect copy of liveStatus.
  const selectedStatus = statusOptionsByValue[liveStatus];

  const [searchValue, setSearchValue] = useState('');

  const commit = (status: TaskStatusType) => {
    if (!statusOptions.some((s) => s.value === status)) return;
    if (liveStatus !== status) onChange(status);
    setSearchValue('');
    useDropdowner.getState().remove();
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
        if (inNumbersArray(7, value)) {
          commit(Number.parseInt(value, 10) - 1);
          return;
        }
        setSearchValue(value);
      }}
    >
      <div
        className="relative rounded-lg sm:w-(--trigger-width)"
        style={{ '--trigger-width': `${triggerWidth}px` } as CSSProperties}
      >
        <ComboboxSearchInput
          autoFocus
          value={searchValue}
          wrapClassName="max-sm:hidden"
          className="rounded-none leading-normal focus-visible:ring-transparent"
          placeholder={t('c:select_resource', { resource: t('c:status').toLowerCase() })}
          showClear={false}
        />
        {!searchValue.length && <Kbd className="absolute top-2.5 right-2.5 max-sm:hidden">S</Kbd>}
        <ComboboxList className="p-1">
          {(status: StatusOption) => {
            const index = statusOptions.findIndex((s) => s.value === status.value);
            return (
              <ComboboxItem
                key={status.value}
                value={status}
                className="group flex w-full items-center gap-2 rounded-md leading-normal"
              >
                <status.icon
                  className={`size-4 fill-current group-hover:opacity-100 ${statusFillColors[status.value]}`}
                />
                <div className="grow">{t(`c:${status.status}`)}</div>
                <ComboboxItemIndicator className="text-success" />
                {!searchValue && <span className="mx-1 text-xs opacity-50 max-sm:hidden">{index + 1}</span>}
              </ComboboxItem>
            );
          }}
        </ComboboxList>
        <ComboboxEmpty>{t('c:no_resource_found', { resource: t('c:status').toLowerCase() })}</ComboboxEmpty>
      </div>
    </Combobox>
  );
};
