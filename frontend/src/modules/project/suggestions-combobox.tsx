import { useInfiniteQuery } from '@tanstack/react-query';
import { BriefcaseIcon, ChevronsUpDownIcon, SearchIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChannelBase } from 'sdk';
import { useDebounce } from '~/hooks/use-debounce';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { projectsListQueryOptions } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { Badge } from '~/modules/ui/badge';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxPrimitive,
  ComboboxSearchInput,
} from '~/modules/ui/combobox';
import { ScrollArea } from '~/modules/ui/scroll-area';
import { findWorkspaceByIdOrSlug } from '~/modules/workspace/query';
import { flattenInfiniteData } from '~/query/basic/flatten';

interface Props {
  value: ChannelBase[];
  workspaceId: string;
  tenantId: string;
  targetOrgId: string;
  organizationName: string;
  onChange: (items: ChannelBase[]) => void;
}

export const ProjectSuggestionCombobox = ({
  value,
  workspaceId,
  tenantId,
  targetOrgId,
  organizationName,
  onChange,
}: Props) => {
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Check if project is already assigned to any workspace (via enrichment pipeline)
  const getAssignedWorkspaceId = (project: EnrichedProject) => project.membership?.workspaceId ?? null;

  const { data, isFetching } = useInfiniteQuery({
    ...projectsListQueryOptions({ q: debouncedSearchQuery, organizationId: targetOrgId, excludeArchived: 'true' }),
    enabled: true,
  });
  const projects = flattenInfiniteData<EnrichedProject>(data);

  const variants = {
    hidden: { opacity: 0, y: -5, scale: 0.98 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.1 } },
    exit: { opacity: 0, y: -5, scale: 0.98, transition: { duration: 0.1 } },
  };

  // Mirror selection back to value (multi). Compare by id since identities can differ.
  const selectedIds = new Set(value.map((v) => v.id));
  const selected = projects.filter((p) => selectedIds.has(p.id));

  return (
    <Combobox<EnrichedProject, true>
      multiple
      items={projects}
      itemToStringLabel={(p) => p.name}
      itemToStringValue={(p) => p.id}
      value={selected}
      onValueChange={(items) => {
        // Preserve selected items that aren't in current results.
        const inResultsIds = new Set(items.map((p) => p.id));
        const carriedOver = value.filter((v) => !projects.some((p) => p.id === v.id));
        onChange([...carriedOver, ...items.filter((p) => inResultsIds.has(p.id))]);
      }}
      inputValue={searchQuery}
      onInputValueChange={setSearchQuery}
      filter={() => true}
    >
      <ComboboxPrimitive.Trigger
        nativeButton={false}
        render={
          <div className="hover:transparent relative flex min-h-12 w-full cursor-pointer flex-wrap items-center gap-1 rounded-md border border-input bg-background p-1.5 pr-10 active:translate-y-0!" />
        }
      >
        {value.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {value.map((item) => (
              <Badge key={item.id} variant="secondary" className="flex items-center gap-1.5 py-1 pr-2 pl-1">
                <EntityAvatar
                  type={item.entityType}
                  className="h-4 w-4 shrink-0"
                  id={item.id}
                  name={item.name}
                  url={item.thumbnailUrl}
                />
                <span className="font-medium text-xs leading-none">{item.name}</span>
              </Badge>
            ))}
          </div>
        ) : (
          <span className="ml-1 text-sm">
            {t('c:select_resource', { resource: t('c:project_other').toLowerCase() })}
          </span>
        )}

        <ChevronsUpDownIcon className="absolute right-0 mx-2 h-4 w-4 shrink-0 opacity-50" />
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
              {!isFetching && !projects.length ? (
                <motion.div
                  key="empty-state"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={variants}
                  className="h-full"
                >
                  {debouncedSearchQuery.length ? (
                    <ComboboxEmpty>
                      <ContentPlaceholder
                        icon={SearchIcon}
                        title="c:no_resource_found"
                        titleProps={{ resource: t('c:project').toLowerCase() }}
                      />
                    </ComboboxEmpty>
                  ) : (
                    <ComboboxEmpty>
                      <ContentPlaceholder
                        icon={BriefcaseIcon}
                        title="c:select_project.text"
                        titleProps={{ name: organizationName }}
                      />
                    </ComboboxEmpty>
                  )}
                </motion.div>
              ) : (
                projects.length > 0 && (
                  <motion.div key="results" initial="hidden" animate="visible" exit="exit" variants={variants}>
                    {projects.map((project) => {
                      const { id, entityType, name, thumbnailUrl } = project;
                      const isSelected = value.some((v) => v.id === id);
                      const assignedWsId = getAssignedWorkspaceId(project);
                      const isAssigned = !!assignedWsId;
                      const assignedWorkspace = assignedWsId ? findWorkspaceByIdOrSlug(assignedWsId, tenantId) : null;

                      return (
                        <ComboboxItem
                          key={id}
                          value={project}
                          disabled={isAssigned && !isSelected}
                          data-project-selected={isSelected}
                          data-assigned-workspace={isAssigned}
                          className="group w-full justify-between"
                        >
                          <div className="flex items-center space-x-2 outline-0 ring-0">
                            <EntityAvatar
                              type={entityType}
                              className="h-8 w-8"
                              id={id}
                              name={name}
                              url={thumbnailUrl}
                            />
                            <span className="truncate font-medium underline-offset-4 group-hover:underline group-data-[assigned-workspace=true]:no-underline">
                              {name}
                            </span>
                          </div>

                          <div className="flex items-center gap-0.5">
                            <Badge
                              size="sm"
                              variant="plain"
                              className="invisible gap-1 group-data-[assigned-workspace=true]:visible max-sm:hidden"
                            >
                              <span className="max-w-32 truncate">
                                {assignedWsId === workspaceId
                                  ? t('c:in_current_workspace')
                                  : (assignedWorkspace?.name ?? t('c:in_another_workspace'))}
                              </span>
                            </Badge>
                          </div>
                        </ComboboxItem>
                      );
                    })}
                  </motion.div>
                )
              )}
            </AnimatePresence>
          </ComboboxList>
        </ScrollArea>
      </ComboboxContent>
    </Combobox>
  );
};
