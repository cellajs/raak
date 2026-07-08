import { type CSSProperties, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import type { SelectPointsProps } from '~/modules/task/dropdowns/types';
import { useTaskQuery } from '~/modules/task/hooks/use-task-query';
import { pointsOptions, pointsOptionsByValue } from '~/modules/task/task-properties';
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

  // Live cache subscription reflects remote SSE points changes while open.
  const { data: liveTask } = useTaskQuery(taskId);
  const livePoints = liveTask ? liveTask.points : currentPoints;

  // Derived during render, without a useState/useEffect copy of livePoints.
  const selectedPoints =
    livePoints !== null && livePoints !== undefined ? (pointsOptionsByValue[livePoints] ?? null) : null;

  const [searchValue, setSearchValue] = useState('');
  const isSearching = searchValue.length > 0;

  const commit = (points: TaskPointsType) => {
    if (points === null || !pointsOptionsByValue[points]) return;
    if (livePoints !== points) onChange(points);
    setSearchValue('');
    useDropdowner.getState().remove();
  };

  return (
    <Combobox<PointsOption>
      inline
      openOnInputClick={false}
      items={pointsOptions}
      itemToStringLabel={(item) => item.label}
      itemToStringValue={(item) => String(item.value)}
      value={selectedPoints}
      onValueChange={(item) => item && commit(item.value)}
      inputValue={searchValue}
      onInputValueChange={(value) => {
        // Digit hotkey: 1-4 selects the corresponding points option (value 0-3)
        if (inNumbersArray(4, value)) {
          commit((Number.parseInt(value, 10) - 1) as TaskPointsType);
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
          placeholder={t('c:select_resource', { resource: t('c:points').toLowerCase() })}
          showClear={false}
        />
        {!isSearching && <Kbd className="absolute top-2.5 right-2.5 max-sm:hidden">I</Kbd>}
        <ComboboxList className="p-1">
          {(points: PointsOption) => (
            <ComboboxItem
              key={points.value}
              value={points}
              className="group flex w-full items-center gap-2 rounded-md leading-normal"
            >
              <points.icon
                className={`size-4 fill-current group-hover:opacity-100 ${selectedPoints?.value === points.value ? 'fill-primary' : 'opacity-70'}`}
              />
              <div className="grow">{points.label}</div>
              <ComboboxItemIndicator className="text-success" />
              {!isSearching && <span className="mx-1 text-xs opacity-50 max-sm:hidden">{points.value + 1}</span>}
            </ComboboxItem>
          )}
        </ComboboxList>
        <ComboboxEmpty>{t('c:no_resource_found', { resource: t('c:points').toLowerCase() })}</ComboboxEmpty>
      </div>
    </Combobox>
  );
};
