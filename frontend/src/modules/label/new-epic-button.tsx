import { useInfiniteQuery } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isUnconditionalCan, labelSlug } from 'shared';
import { generateId } from 'shared/utils/entity-id';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { useSearchParams } from '~/hooks/use-search-params';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { useLabelCreateMutation } from '~/modules/label/query';
import type { LabelsScopeProps } from '~/modules/label/types';
import { findProjectByIdOrSlug, projectsListQueryOptions } from '~/modules/project/query';
import { Button } from '~/modules/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/modules/ui/dropdown-menu';
import { COALESCED } from '~/query/offline/prepared-mutation';

/**
 * Creates an epic label and opens its page for naming + documentation. Epics are
 * project-homed, so the workspace panel offers a project picker; targets are limited to
 * projects the user administers (the backend enforces the same authority).
 */
export const NewEpicButton = ({ entity, entityId }: LabelsScopeProps) => {
  const { t } = useTranslation();
  const { organization, tenantId } = useOrganizationLayoutContext();
  const { setSearch } = useSearchParams<{ labelPageId?: string }>({});
  const createLabel = useLabelCreateMutation(tenantId, organization.id);

  const { data: workspaceProjects } = useInfiniteQuery({
    ...projectsListQueryOptions({ workspaceId: entityId }),
    enabled: entity === 'workspace',
    select: (data) => data.pages.flatMap((page) => page.items),
  });

  const targets =
    entity === 'project' ? [findProjectByIdOrSlug(entityId, tenantId)].filter((p) => !!p) : (workspaceProjects ?? []);
  const adminTargets = targets.filter((project) => isUnconditionalCan(project.can?.project?.update));

  if (!adminTargets.length) return null;

  const createEpic = async (projectId: string) => {
    const name = t('c:new_epic');
    const created = await createLabel.mutateAsync({
      id: generateId(),
      name,
      slug: labelSlug(name),
      mode: 'epic',
      icon: 'book-open',
      color: 'violet',
      projectId,
    });
    if (created !== COALESCED) setSearch({ labelPageId: created.id });
  };

  if (adminTargets.length === 1) {
    return (
      <TooltipButton toolTipContent={t('c:new_epic')}>
        <Button variant="ghost" size="icon" aria-label={t('c:new_epic')} onClick={() => createEpic(adminTargets[0].id)}>
          <PlusIcon />
        </Button>
      </TooltipButton>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={t('c:new_epic')} />}>
        <PlusIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-48 p-1" align="end">
        {adminTargets.map((project) => (
          <DropdownMenuItem key={project.id} onClick={() => createEpic(project.id)}>
            {project.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
