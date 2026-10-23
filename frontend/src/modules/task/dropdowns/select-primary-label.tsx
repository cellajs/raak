import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Label } from 'sdk';
import { ComboboxSearchInput } from '~/modules/common/combobox-search-input';
import { dropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { PrimaryLabelIcon } from '~/modules/label/primary-label-icon';
import { usePrimaryLabels } from '~/modules/label/use-primary-labels';
import { ComboboxHotkeyHint, comboboxRowClass, HotkeyIndexBadge, matchDigitHotkey } from '~/modules/task/dropdowns/combobox-parts';
import type { SelectPrimaryLabelProps } from '~/modules/task/dropdowns/types';
import { useTaskQuery } from '~/modules/task/hooks/use-task-query';
import { Combobox, ComboboxEmpty, ComboboxItem, ComboboxList } from '~/modules/ui/combobox';
import { isTouchInteraction } from '~/utils/input-modality';

/** Dropdown to pick a task's primary label (task type) from the project's primary set. */
export function SelectPrimaryLabel({ value: currentId, projectId, onChange, taskId }: SelectPrimaryLabelProps) {
  const { t } = useTranslation();
  const primaryLabels = usePrimaryLabels(projectId);

  const { data: liveTask } = useTaskQuery(taskId);
  const liveId = liveTask?.primaryLabelId ?? currentId;

  const selected = primaryLabels.find((label) => label.id === liveId) ?? null;

  const [searchValue, setSearchValue] = useState('');
  const isSearching = searchValue.length > 0;

  const commit = (label: Label) => {
    if (liveId !== label.id) onChange(label.id);
    setSearchValue('');
    dropdowner.getState().remove();
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
        const label = matchDigitHotkey(primaryLabels, value);
        if (label) {
          commit(label);
          return;
        }
        setSearchValue(value);
      }}
    >
      <div className="relative w-48 rounded-lg max-sm:w-full">
        <ComboboxSearchInput
          autoFocus={!isTouchInteraction()}
          value={searchValue}
          wrapClassName="max-sm:hidden"
          className="leading-normal"
          placeholder={t('c:select_resource', { resource: t('c:type').toLowerCase() })}
          showClear={false}
        />
        <ComboboxHotkeyHint searching={isSearching}>T</ComboboxHotkeyHint>
        <ComboboxList>
          {(label: Label) => {
            const index = primaryLabels.findIndex((primaryLabel) => primaryLabel.id === label.id);
            return (
              <ComboboxItem key={label.id} value={label} className={comboboxRowClass}>
                <PrimaryLabelIcon label={label} />
                <div className="grow">{label.name}</div>
                <HotkeyIndexBadge index={isSearching ? undefined : index} />
              </ComboboxItem>
            );
          }}
        </ComboboxList>
        <ComboboxEmpty>{t('c:no_resource_found', { resource: t('c:type').toLowerCase() })}</ComboboxEmpty>
      </div>
    </Combobox>
  );
}
