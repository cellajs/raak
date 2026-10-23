import { type CSSProperties, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UserMinimalBase } from 'sdk';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { ComboboxSearchInput } from '~/modules/common/combobox-search-input';
import { dropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import type { Member } from '~/modules/memberships/types';
import { useProjectMembers } from '~/modules/project/use-project-members';
import {
  ComboboxHotkeyHint,
  comboboxActionButtonClass,
  comboboxScrollClass,
  comboboxShellClass,
  HotkeyIndexBadge,
  matchDigitHotkey,
} from '~/modules/task/dropdowns/combobox-parts';
import type { SelectMembersProps } from '~/modules/task/dropdowns/types';
import { getItemsSortedByName } from '~/modules/task/helpers/sort-helpers';
import { useLiveSelection } from '~/modules/task/hooks/use-live-selection';
import { Combobox, ComboboxEmpty, ComboboxItem, ComboboxItemIndicator, ComboboxList } from '~/modules/ui/combobox';
import { ScrollArea } from '~/modules/ui/scroll-area';
import { isTouchInteraction } from '~/utils/input-modality';

/** Members listed before "Show all"; the digit hotkeys cover the same range. */
const initialMembersCount = 6;

export function SelectMembers({ value: currentAssigned, projectId, onChange, taskId, triggerWidth = 320 }: SelectMembersProps) {
  const { t } = useTranslation();
  const { organizationId, tenantId } = useOrganizationLayoutContext();

  const projectMembers = useProjectMembers(projectId, tenantId, organizationId);

  const [selectedMembers, setSelectedMembers] = useLiveSelection(taskId, (task) => task.assignedTo, currentAssigned);

  const [searchValue, setSearchValue] = useState('');
  const [showAll, setShowAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Freeze the initial display list at mount so it stays static during the session
  const frozenMembersRef = useRef<Member[] | null>(null);
  if (frozenMembersRef.current === null && projectMembers.length) {
    frozenMembersRef.current = projectMembers.slice(0, initialMembersCount);
  }
  const frozenMembers = frozenMembersRef.current ?? projectMembers.slice(0, initialMembersCount);

  const visibleMembers = (() => {
    if (searchValue.length) return projectMembers.filter((member) => member.name.toLowerCase().includes(searchValue.toLowerCase()));
    if (showAll) return projectMembers;
    return frozenMembers;
  })();

  const toggleMember = (id: string) => {
    setSearchValue('');
    if (inputRef.current && !isTouchInteraction()) inputRef.current.focus();

    const existing = selectedMembers.find((member) => member.id === id);
    if (existing) {
      const updated = selectedMembers.filter((member) => member.id !== id);
      setSelectedMembers(updated);
      onChange(updated);
      return;
    }
    const newUser = projectMembers.find((member) => member.id === id);
    if (!newUser) return;
    const updated = getItemsSortedByName([...selectedMembers, newUser]);
    setSelectedMembers(updated);

    // Close dropdown once every visible member is selected (by identity, not just count:
    // an assignee outside the frozen initial list must not trip the close early).
    if (visibleMembers.length > 0 && visibleMembers.every((m) => updated.some((u) => u.id === m.id))) {
      dropdowner.getState().remove();
    }

    onChange(updated);
  };

  return (
    <Combobox<UserMinimalBase, true>
      inline
      multiple
      openOnInputClick={false}
      items={visibleMembers}
      itemToStringLabel={(item) => item.name}
      itemToStringValue={(item) => item.id}
      // Values and items have different object shapes, so compare IDs to keep selection
      // indicators and toggling aligned.
      isItemEqualToValue={(item, value) => item.id === value.id}
      value={selectedMembers}
      onValueChange={(items) => {
        // Diff against current selection to drive our own toggle (handles sort + dropdown auto-close).
        const prevIds = new Set(selectedMembers.map((member) => member.id));
        const nextIds = new Set(items.map((member) => member.id));
        const added = items.find((member) => !prevIds.has(member.id));
        const removed = selectedMembers.find((member) => !nextIds.has(member.id));
        const changedId = added?.id ?? removed?.id;
        if (changedId) toggleMember(changedId);
      }}
      inputValue={searchValue}
      onInputValueChange={(value) => {
        // Digit hotkey: select by 1-based index in the initial members
        const target = matchDigitHotkey(projectMembers, value, { max: initialMembersCount, enabled: !showAll });
        if (target) {
          toggleMember(target.id);
          return;
        }
        setSearchValue(value);
      }}
      filter={() => true}
    >
      <div className={comboboxShellClass} style={{ '--trigger-width': `${triggerWidth}px` } as CSSProperties}>
        <ComboboxSearchInput
          ref={inputRef}
          autoFocus={!isTouchInteraction()}
          value={searchValue}
          wrapClassName="shrink-0 max-sm:hidden"
          className="min-h-10 rounded-none leading-normal focus-visible:ring-transparent"
          placeholder={t('c:assign_to')}
          showClear={false}
        />
        <ComboboxHotkeyHint searching={!!searchValue.length}>U</ComboboxHotkeyHint>
        <ScrollArea className={comboboxScrollClass}>
          <ComboboxList className="p-1">
            {(user: UserMinimalBase) => {
              const index = visibleMembers.findIndex((member) => member.id === user.id);
              return (
                <ComboboxItem key={user.id} value={user} className="group flex h-9 w-full items-center gap-2 rounded-md pr-2 leading-normal">
                  <EntityAvatar
                    type="user"
                    id={user.id}
                    name={user.name}
                    url={user.thumbnailUrl}
                    className="h-6 w-6 text-xs group-hover:opacity-100"
                  />
                  <div className="grow">{user.name}</div>
                  <ComboboxItemIndicator className="text-success" />
                  <HotkeyIndexBadge index={!searchValue.length && !showAll ? index : undefined} />
                </ComboboxItem>
              );
            }}
          </ComboboxList>
          <ComboboxEmpty>{t('c:no_resource_found', { resource: t('c:member_other').toLowerCase() })}</ComboboxEmpty>
          {projectMembers.length > initialMembersCount && !searchValue.length && (
            <div className="p-1 pt-0">
              <button
                type="button"
                className={comboboxActionButtonClass}
                onClick={() => {
                  setShowAll(!showAll);
                  if (inputRef.current && !isTouchInteraction()) inputRef.current.focus();
                }}
              >
                {showAll ? t('c:show_less') : t('c:show_all')}
              </button>
            </div>
          )}
        </ScrollArea>
      </div>
    </Combobox>
  );
}
