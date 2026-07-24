import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Label } from 'sdk';
import { useDropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { PrimaryLabelIcon } from '~/modules/label/primary-label-icon';
import { usePrimaryLabels } from '~/modules/label/use-primary-labels';
import type { SelectPrimaryLabelProps } from '~/modules/task/dropdowns/types';
import { useTaskQuery } from '~/modules/task/hooks/use-task-query';
import { Combobox, ComboboxEmpty, ComboboxItem, ComboboxList, ComboboxSearchInput } from '~/modules/ui/combobox';
import { Kbd } from '~/modules/ui/kbd';
import { cn } from '~/utils/cn';
import { inNumbersArray } from '~/utils/in-numbers-array';

/** Dropdown to pick a task's primary label (task type) from the project's primary set. */
export const SelectPrimaryLabel = ({
  value: currentId,
  projectId,
  onChange,
  taskId,
  className = '',
}: SelectPrimaryLabelProps) => {
  const { t } = useTranslation();
  const primaryLabels = usePrimaryLabels(projectId);

  // Live cache subscription reflects remote SSE primary label changes while open.
  const { data: liveTask } = useTaskQuery(taskId);
  const liveId = liveTask?.primaryLabelId ?? currentId;

  // Derived during render, without a useState/useEffect copy of liveId.
  const selected = primaryLabels.find((label) => label.id === liveId) ?? null;

  const [searchValue, setSearchValue] = useState('');
  const isSearching = searchValue.length > 0;

  const commit = (label: Label) => {
    if (liveId !== label.id) onChange(label.id);
    setSearchValue('');
    useDropdowner.getState().remove();
  };

  return (
    <Combobox<Label>
      inline
      openOnInputClick={false}
      items={primaryLabels}
      itemToStringLabel={(item) => item.name}
      itemToStringValue={(item) => item.id}
      value={selected}
      onValueChange={(item) => {
        if (item) commit(item);
      }}
      inputValue={searchValue}
      onInputValueChange={(value) => {
        // Digit hotkey: selects the corresponding primary label by display order
        if (inNumbersArray(primaryLabels.length, value)) {
          const label = primaryLabels[Number.parseInt(value, 10) - 1];
          if (label) commit(label);
          return;
        }
        setSearchValue(value);
      }}
    >
      <div className={cn(className, 'relative w-48 rounded-lg p-0 max-sm:w-full')}>
        <ComboboxSearchInput
          autoFocus
          value={searchValue}
          wrapClassName="max-sm:hidden"
          className="leading-normal"
          placeholder={t('c:select_resource', { resource: t('c:type').toLowerCase() })}
          showClear={false}
        />
        {!isSearching && <Kbd className="absolute top-2.5 right-2.5 max-sm:hidden">T</Kbd>}
        <ComboboxList className="p-1">
          {(label: Label) => {
            const index = primaryLabels.findIndex((l) => l.id === label.id);
            return (
              <ComboboxItem
                key={label.id}
                value={label}
                className="group flex w-full items-center gap-2 rounded-md leading-normal"
              >
                <PrimaryLabelIcon label={label} />
                <div className="grow">{label.name}</div>
                {!isSearching && <span className="mx-1 text-xs opacity-50 max-sm:hidden">{index + 1}</span>}
              </ComboboxItem>
            );
          }}
        </ComboboxList>
        <ComboboxEmpty>{t('c:no_resource_found', { resource: t('c:type').toLowerCase() })}</ComboboxEmpty>
      </div>
    </Combobox>
  );
};
