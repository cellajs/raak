import { useInfiniteQuery } from '@tanstack/react-query';
import { BriefcaseIcon, SearchIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChannelBase } from 'sdk';
import { useDebounce } from '~/hooks/use-debounce';
import { ComboboxSearchInput } from '~/modules/common/combobox-search-input';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { InputTriggerChevron } from '~/modules/common/form-fields/input-trigger-button';
import { projectsListQueryOptions } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { Badge } from '~/modules/ui/badge';
import { Chip } from '~/modules/ui/chip';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxPrimitive,
} from '~/modules/ui/combobox';
import { ScrollArea } from '~/modules/ui/scroll-area';
import { findWorkspaceByIdOrSlug } from '~/modules/workspace/query';
import { flattenInfiniteData } from '~/query/basic/flatten';

const dropdownVariants = {
  hidden: { opacity: 0, y: -5, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.1 } },
  exit: { opacity: 0, y: -5, scale: 0.98, transition: { duration: 0.1 } },
};

interface ProjectSuggestionComboboxProps {
  value: ChannelBase[];
  workspaceId: string;
  tenantId: string;
  organizationId: string;
  organizationName: string;
  onChange: (items: ChannelBase[]) => void;
}

export function ProjectSuggestionCombobox({
  value,
  workspaceId,
  tenantId,
  organizationId,
  organizationName,
  onChange,
}: ProjectSuggestionComboboxProps) {
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const { data, isFetching } = useInfiniteQuery(projectsListQueryOptions({ q: debouncedSearchQuery, organizationId, excludeArchived: 'true' }));
  const projects = flattenInfiniteData<EnrichedProject>(data);

  // Compared by id: the list and the selection hold different object identities.
  const selectedIds = new Set(value.map((item) => item.id));
  const selected = projects.filter((project) => selectedIds.has(project.id));

  // The removed chip takes its focused button along, so focus moves to the trigger
  const handleRemove = (id: string) => {
    onChange(value.filter((item) => item.id !== id));
    triggerRef.current?.focus();
  };

  const placeholder = t('c:select_resource', { resource: t('c:project_other') });

  return (
    <Combobox<EnrichedProject, true>
      multiple
      items={projects}
      itemToStringLabel={(project) => project.name}
      itemToStringValue={(project) => project.id}
      value={selected}
      onValueChange={(items) => {
        // Preserve selected items that aren't in current results.
        const carriedOver = value.filter((item) => !projects.some((project) => project.id === item.id));
        onChange([...carriedOver, ...items]);
      }}
      inputValue={searchQuery}
      onInputValueChange={setSearchQuery}
      filter={() => true}
    >
      <div className="relative flex min-h-10 w-full items-center rounded-md border border-input bg-background p-1.5 pr-10">
        {/* The chips sit outside the trigger, since their remove buttons cannot nest in it; it still announces the selection */}
        <ComboboxPrimitive.Trigger
          ref={triggerRef}
          render={<button type="button" className="focus-effect absolute inset-0 cursor-pointer rounded-md" />}
        >
          <span className="sr-only">{value.length > 0 ? value.map((item) => item.name).join(', ') : placeholder}</span>
        </ComboboxPrimitive.Trigger>
        <div className="pointer-events-none relative flex min-w-0 flex-wrap items-center gap-1">
          {value.length > 0 ? (
            value.map((item) => (
              <Chip key={item.id} onRemove={() => handleRemove(item.id)} removeLabel={t('c:remove_resource', { resource: item.name })}>
                {item.name}
              </Chip>
            ))
          ) : (
            <span aria-hidden="true" className="ml-1 text-sm">
              {placeholder}
            </span>
          )}
        </div>
        <InputTriggerChevron className="pointer-events-none absolute right-0 mx-2" />
      </div>

      <ComboboxContent className="p-0">
        <ComboboxSearchInput
          value={searchQuery}
          isSearching={isFetching}
          placeholder={t('c:placeholder.type_input', { inputLabel: t('c:project') })}
        />
        <ScrollArea>
          <ComboboxList className="h-full px-1">
            <AnimatePresence mode="wait">
              {!isFetching && !projects.length && (
                <motion.div key="empty-state" initial="hidden" animate="visible" exit="exit" variants={dropdownVariants} className="h-full">
                  <ComboboxEmpty>
                    {debouncedSearchQuery.length ? (
                      <ContentPlaceholder icon={SearchIcon} title="c:no_resource_found" titleOptions={{ resource: t('c:project') }} />
                    ) : (
                      <ContentPlaceholder icon={BriefcaseIcon} title="c:select_project.text" titleOptions={{ name: organizationName }} />
                    )}
                  </ComboboxEmpty>
                </motion.div>
              )}
              {projects.length > 0 && (
                <motion.div key="results" initial="hidden" animate="visible" exit="exit" variants={dropdownVariants}>
                  {projects.map((project) => {
                    const { id, entityType, name, thumbnailUrl } = project;
                    const isSelected = selectedIds.has(id);
                    const assignedWorkspaceId = project.membership?.workspaceId;
                    const isAssigned = !!assignedWorkspaceId;
                    const assignedWorkspace = assignedWorkspaceId ? findWorkspaceByIdOrSlug(assignedWorkspaceId, tenantId) : null;

                    return (
                      <ComboboxItem
                        key={id}
                        value={project}
                        disabled={isAssigned && !isSelected}
                        data-assigned-workspace={isAssigned}
                        className="group/project-option justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <EntityAvatar type={entityType} id={id} name={name} url={thumbnailUrl} />
                          <span className="truncate font-medium underline-offset-4 group-hover/project-option:underline group-data-[assigned-workspace=true]/project-option:no-underline">
                            {name}
                          </span>
                        </div>

                        <div className="flex items-center gap-0.5">
                          <Badge size="sm" soft className="invisible gap-1 group-data-[assigned-workspace=true]/project-option:visible max-sm:hidden">
                            <span className="max-w-32 truncate">
                              {assignedWorkspaceId === workspaceId
                                ? t('c:in_current_workspace')
                                : (assignedWorkspace?.name ?? t('c:in_another_workspace'))}
                            </span>
                          </Badge>
                          <ComboboxItemIndicator />
                        </div>
                      </ComboboxItem>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </ComboboxList>
        </ScrollArea>
      </ComboboxContent>
    </Combobox>
  );
}
