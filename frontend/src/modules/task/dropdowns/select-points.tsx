import { type CSSProperties, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import type { SelectPointsProps } from '~/modules/task/dropdowns/types';
import { useTaskQuery } from '~/modules/task/hooks/use-task-query';
import { pointsOptions } from '~/modules/task/task-properties';
import type { TaskPointsType } from '~/modules/task/types';
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

type PointsOption = (typeof pointsOptions)[number];

export const SelectPoints = ({ value: currentPoints, onChange, taskId, triggerWidth = 192 }: SelectPointsProps) => {
  const { t } = useTranslation();

  // Live cache subscription — reflects remote SSE points changes while open.
  const { data: liveTask } = useTaskQuery(taskId);
  const livePoints = liveTask ? (liveTask.points as TaskPointsType | null) : currentPoints;

  // Derived during render — no useState/useEffect copy of livePoints.
  const selectedPoints = livePoints !== null ? (pointsOptions[livePoints] ?? null) : null;

  const [searchValue, setSearchValue] = useState('');
  const isSearching = searchValue.length > 0;

  const commitByIndex = (index: TaskPointsType) => {
    if (index === null) return;
    if (!pointsOptions[index]) return;
    if (livePoints !== index) onChange(index);
    setSearchValue('');
    useDropdowner.getState().remove();
  };

  return (
    <Combobox<PointsOption>
      inline
      openOnInputClick={false}
      items={pointsOptions}
      itemToStringLabel={(item) => item.label}
      itemToStringValue={(item) => item.value}
      value={selectedPoints}
      onValueChange={(item) => {
        if (!item) return;
        const idx = pointsOptions.findIndex((p) => p.value === item.value) as TaskPointsType;
        commitByIndex(idx);
      }}
      inputValue={searchValue}
      onInputValueChange={(value) => {
        // Digit hotkey: 1-4 selects the corresponding points option
        if (inNumbersArray(4, value)) {
          commitByIndex((Number.parseInt(value, 10) - 1) as TaskPointsType);
          return;
        }
        setSearchValue(value);
      }}
    >
      <div
        className="relative w-full rounded-lg sm:w-(--trigger-width)"
        style={{ '--trigger-width': `${triggerWidth}px` } as CSSProperties}
      >
        <ComboboxSearchInput
          autoFocus
          value={searchValue}
          wrapClassName="max-sm:hidden"
          className="leading-normal"
          placeholder={t('c:placeholder.points')}
          showClear={false}
        />
        {!isSearching && <Kbd className="absolute top-2.5 right-2.5 max-sm:hidden">I</Kbd>}
        <ComboboxList className="p-1">
          {(Points: PointsOption) => {
            const index = pointsOptions.findIndex((p) => p.value === Points.value);
            return (
              <ComboboxItem
                key={Points.value}
                value={Points}
                className="group flex w-full items-center gap-2 rounded-md leading-normal"
              >
                <Points.icon
                  className={`size-4 fill-current group-hover:opacity-100 ${selectedPoints?.value === Points.value ? 'fill-primary' : 'opacity-70'}`}
                />
                <div className="grow">{Points.label}</div>
                <ComboboxItemIndicator className="text-success" />
                {!isSearching && <span className="mx-1 text-xs opacity-50 max-sm:hidden">{index + 1}</span>}
              </ComboboxItem>
            );
          }}
        </ComboboxList>
        <ComboboxEmpty>{t('c:no_resource_found', { resource: t('c:points').toLowerCase() })}</ComboboxEmpty>
      </div>
    </Combobox>
  );
};
