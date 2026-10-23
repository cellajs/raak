import { useInfiniteQuery } from '@tanstack/react-query';
import { BriefcaseIcon, ChevronsUpDownIcon, SearchIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChannelBase } from 'sdk';
import { useDebounce } from '~/hooks/use-debounce';
import { ComboboxSearchInput } from '~/modules/common/combobox-search-input';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import { EntityAvatar } from '~/modules/common/entity-avatar';
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

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const { data, isFetching } = useInfiniteQuery(projectsListQueryOptions({ q: debouncedSearchQuery, organizationId, excludeArchived: 'true' }));
  const projects = flattenInfiniteData<EnrichedProject>(data);

  // Compared by id: the list and the selection hold different object identities.
  const selectedIds = new Set(value.map((item) => item.id));
  const selected = projects.filter((project) => selectedIds.has(project.id));

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
      <ComboboxPrimitive.Trigger
        nativeButton={false}
        render={
          <div className="relative flex min-h-12 w-full cursor-pointer flex-wrap items-center gap-1 rounded-md border border-input bg-background p-1.5 pr-10" />
        }
      >
        {value.length > 0 ? (
          <div className="flex min-w-0 flex-wrap gap-1">
            {value.map((item) => (
              <Chip key={item.id}>{item.name}</Chip>
            ))}
          </div>
        ) : (
          <span className="ml-1 text-sm">{t('c:select_resource', { resource: t('c:project_other').toLowerCase() })}</span>
        )}

        <ChevronsUpDownIcon className="absolute right-0 mx-2 shrink-0 opacity-50" />
      </ComboboxPrimitive.Trigger>

      <ComboboxContent className="p-0">
        <ComboboxSearchInput
          value={searchQuery}
          isSearching={isFetching}
          placeholder={t('c:placeholder.type_input', { inputLabel: t('c:project').toLowerCase() })}
        />
        <ScrollArea>
          <ComboboxList className="h-full px-1">
            <AnimatePresence mode="wait">
              {!isFetching && !projects.length && (
                <motion.div key="empty-state" initial="hidden" animate="visible" exit="exit" variants={dropdownVariants} className="h-full">
                  <ComboboxEmpty>
                    {debouncedSearchQuery.length ? (
                      <ContentPlaceholder icon={SearchIcon} title="c:no_resource_found" titleProps={{ resource: t('c:project').toLowerCase() }} />
                    ) : (
                      <ContentPlaceholder icon={BriefcaseIcon} title="c:select_project.text" titleProps={{ name: organizationName }} />
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
                          <Badge
                            size="sm"
                            variant="plain"
                            className="invisible gap-1 group-data-[assigned-workspace=true]/project-option:visible max-sm:hidden"
                          >
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
