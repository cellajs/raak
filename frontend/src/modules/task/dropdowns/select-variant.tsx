import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import type { SelectVariantProps } from '~/modules/task/dropdowns/types';
import { useTaskQuery } from '~/modules/task/hooks/use-task-query';
import { variantOptions } from '~/modules/task/task-properties';
import { Combobox, ComboboxEmpty, ComboboxItem, ComboboxList, ComboboxSearchInput } from '~/modules/ui/combobox';
import { Kbd } from '~/modules/ui/kbd';
import { cn } from '~/utils/cn';
import { inNumbersArray } from '~/utils/in-numbers-array';

type VariantOption = (typeof variantOptions)[number];

export const SelectVariant = ({ value: currentVariant, onChange, taskId, className = '' }: SelectVariantProps) => {
  const { t } = useTranslation();

  // Live cache subscription — reflects remote SSE variant changes while open.
  const { data: liveTask } = useTaskQuery(taskId);
  const liveVariant = liveTask?.variant ?? currentVariant;

  // Derived during render — no useState/useEffect copy of liveVariant.
  const selectedType = variantOptions.find((v) => v.value === liveVariant);

  const [searchValue, setSearchValue] = useState('');
  const isSearching = searchValue.length > 0;

  const commit = (variant: VariantOption) => {
    if (liveVariant !== variant.value) onChange(variant.value);
    setSearchValue('');
    useDropdowner.getState().remove();
  };

  return (
    <Combobox<VariantOption>
      inline
      openOnInputClick={false}
      items={variantOptions}
      itemToStringLabel={(item) => t(`c:${item.labelKey}`)}
      itemToStringValue={(item) => item.type}
      value={selectedType ?? null}
      onValueChange={(item) => {
        if (item) commit(item);
      }}
      inputValue={searchValue}
      onInputValueChange={(value) => {
        // Digit hotkey: 1-3 selects the corresponding variant
        if (inNumbersArray(3, value)) {
          const variant = variantOptions[Number.parseInt(value, 10) - 1];
          if (variant) commit(variant);
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
          {(variant: VariantOption) => {
            const index = variantOptions.findIndex((v) => v.value === variant.value);
            return (
              <ComboboxItem
                key={variant.value}
                value={variant}
                className="group flex w-full items-center gap-2 rounded-md leading-normal"
              >
                <div>{variant.icon()}</div>
                <div className="grow">{t(`c:${variant.labelKey}`)}</div>
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
