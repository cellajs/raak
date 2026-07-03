import { useInfiniteQuery } from '@tanstack/react-query';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UserMinimalBase } from 'sdk';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { useDropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { membersListQueryOptions } from '~/modules/memberships/query';
import type { Member } from '~/modules/memberships/types';
import type { SelectMembersProps } from '~/modules/task/dropdowns/types';
import { getItemsSortedByName } from '~/modules/task/helpers/sort-helpers';
import { useTaskQuery } from '~/modules/task/hooks/use-task-query';
import {
  Combobox,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxSearchInput,
} from '~/modules/ui/combobox';
import { Kbd } from '~/modules/ui/kbd';
import { ScrollArea } from '~/modules/ui/scroll-area';
import { flattenInfiniteData } from '~/query/basic';
import { inNumbersArray } from '~/utils/in-numbers-array';

export const SelectMembers = ({
  value: currentAssigned,
  projectId,
  onChange,
  taskId,
  triggerWidth = 320,
}: SelectMembersProps) => {
  const { t } = useTranslation();
  const { tenantId, organization } = useOrganizationLayoutContext();

  const membersQuery = useInfiniteQuery(
    membersListQueryOptions({
      entityId: projectId,
      tenantId,
      organizationId: organization.id,
      entityType: 'project',
    }),
  );
  const members = flattenInfiniteData<Member>(membersQuery.data);
  const projectMembers = members.filter((m) => m.membership.projectId === projectId);

  // Subscribe to the task in cache so remote (SSE) assignedTo changes reflect
  // here while the dropdown is open. Falls back to the static prop for
  // create-task forms where no cached task exists yet.
  const { data: liveTask } = useTaskQuery(taskId);
  const liveAssigned = liveTask?.assignedTo ?? currentAssigned;

  // Dropdowner renders a snapshot — value prop won't update on cache changes.
  // Always track selected members locally so the dropdown UI stays in sync.
  const [selectedMembers, setSelectedMembers] = useState<UserMinimalBase[]>(liveAssigned);

  // Reconcile when the live cached task changes. Compare by id set so local
  // optimistic echoes don't cause redundant state writes.
  useEffect(() => {
    const localIds = selectedMembers
      .map((u) => u.id)
      .sort()
      .join(',');
    const remoteIds = liveAssigned
      .map((u) => u.id)
      .sort()
      .join(',');
    if (localIds !== remoteIds) setSelectedMembers(liveAssigned);
  }, [liveAssigned]);

  const [searchValue, setSearchValue] = useState('');
  const [showAll, setShowAll] = useState(false);
  const isMobile = useBreakpointBelow('sm');
  const inputRef = useRef<HTMLInputElement>(null);

  // Freeze the initial display list at mount so it stays static during the session
  const frozenMembersRef = useRef<Member[] | null>(null);
  if (frozenMembersRef.current === null && projectMembers.length) {
    frozenMembersRef.current = projectMembers.slice(0, 6);
  }
  const frozenMembers = frozenMembersRef.current ?? projectMembers.slice(0, 6);

  const showedMembers = (() => {
    if (searchValue.length)
      return projectMembers.filter((m) => m.name.toLowerCase().includes(searchValue.toLowerCase()));
    if (showAll) return projectMembers;
    return frozenMembers;
  })();

  const toggleMember = (id: string) => {
    if (!id) return;
    setSearchValue('');
    if (inputRef.current && !isMobile) inputRef.current.focus();

    const existing = selectedMembers.find((u) => u.id === id);
    if (existing) {
      const updated = selectedMembers.filter((u) => u.id !== id);
      setSelectedMembers(updated);
      onChange(updated);
      return;
    }
    const newUser = projectMembers.find((m) => m.id === id);
    if (!newUser) return;
    const updated = getItemsSortedByName([...selectedMembers, newUser]);
    setSelectedMembers(updated);

    // Close dropdown if all visible members are now selected
    if (updated.length === showedMembers.length) useDropdowner.getState().remove();

    onChange(updated);
  };

  return (
    <Combobox<UserMinimalBase, true>
      inline
      multiple
      openOnInputClick={false}
      items={showedMembers}
      itemToStringLabel={(item) => item.name}
      itemToStringValue={(item) => item.id}
      // base-ui defaults to Object.is for value/item comparison. Our `value` entries
      // (UserMinimalBase from task.assignedTo) and `items` (Member from members query)
      // are distinct objects, so without this the indicator never shows selection and
      // clicking a "selected" item appends a duplicate instead of toggling off.
      isItemEqualToValue={(item, value) => item.id === value.id}
      value={selectedMembers}
      onValueChange={(items) => {
        // Diff against current selection to drive our own toggle (handles sort + dropdown auto-close).
        const prevIds = new Set(selectedMembers.map((m) => m.id));
        const nextIds = new Set(items.map((m) => m.id));
        const added = items.find((m) => !prevIds.has(m.id));
        const removed = selectedMembers.find((m) => !nextIds.has(m.id));
        const changedId = added?.id ?? removed?.id;
        if (changedId) toggleMember(changedId);
      }}
      inputValue={searchValue}
      onInputValueChange={(value) => {
        const membersNum = projectMembers.length;
        // Digit hotkey: select by 1-based index in the first 6 members
        if (!showAll && inNumbersArray(membersNum < 6 ? membersNum : 6, value)) {
          const target = projectMembers[Number.parseInt(value, 10) - 1];
          if (target) toggleMember(target.id);
          return;
        }
        setSearchValue(value);
      }}
      filter={() => true}
    >
      <div
        className="relative rounded-lg sm:max-h-[44vh] sm:w-(--trigger-width)"
        style={{ '--trigger-width': `${triggerWidth}px` } as CSSProperties}
      >
        <ComboboxSearchInput
          ref={inputRef}
          autoFocus
          value={searchValue}
          wrapClassName="max-sm:hidden"
          className="min-h-10 rounded-none leading-normal focus-visible:ring-transparent"
          placeholder={t('c:assign_to')}
          showClear={false}
        />
        {!searchValue.length && <Kbd className="absolute top-2.5 right-2.5 max-sm:hidden">A</Kbd>}
        <ScrollArea>
          <ComboboxList className="p-1">
            {(user: UserMinimalBase) => {
              const index = showedMembers.findIndex((m) => m.id === user.id);
              return (
                <ComboboxItem
                  key={user.id}
                  value={user}
                  className="group flex w-full items-center gap-2 rounded-md leading-normal"
                >
                  <EntityAvatar
                    type="user"
                    id={user.id}
                    name={user.name}
                    url={user.thumbnailUrl}
                    className="h-6 w-6 text-xs group-hover:opacity-100"
                  />
                  <div className="grow">{user.name}</div>
                  <ComboboxItemIndicator className="text-success" />
                  {!searchValue.length && !showAll && (
                    <span className="mx-1 text-xs opacity-50 max-sm:hidden">{index + 1}</span>
                  )}
                </ComboboxItem>
              );
            }}
          </ComboboxList>
          <ComboboxEmpty>{t('c:no_resource_found', { resource: t('c:member_other').toLowerCase() })}</ComboboxEmpty>
          {projectMembers.length > 5 && !searchValue.length && (
            <button
              type="button"
              className="flex w-full items-center justify-center rounded-sm py-1.5 text-sm opacity-80 hover:bg-accent hover:opacity-100"
              onClick={() => {
                setShowAll(!showAll);
                if (inputRef.current && !isMobile) inputRef.current.focus();
              }}
            >
              <span className="text-sm sm:text-xs">{showAll ? t('c:show_less') : t('c:show_all')}</span>
            </button>
          )}
        </ScrollArea>
      </div>
    </Combobox>
  );
};
