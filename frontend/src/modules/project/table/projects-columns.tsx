import { Link } from '@tanstack/react-router';
import i18n from 'i18next';
import { GlobeIcon, LockIcon, PencilIcon, ShieldIcon, TrashIcon, UserRoundIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { hierarchy, isProduct } from 'shared';
import { getMemberStatIcon } from '~/lib/entity-modules';
import { CheckboxColumn } from '~/modules/common/data-table/checkbox-column';
import { cellLinkTextClass, countColumn, dateColumn, ellipsisColumn } from '~/modules/common/data-table/columns';
import type { EllipsisOption } from '~/modules/common/data-table/table-ellipsis';
import type { ColumnOrColumnGroup } from '~/modules/common/data-table/types';
import { useColumnVisibility } from '~/modules/common/data-table/use-column-visibility';
import { useDropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { NamedText } from '~/modules/common/named-text';
import { openPopConfirm } from '~/modules/common/popconfirm';
import { openEditSheet } from '~/modules/common/sheeter/open-edit-sheet';
import { useResolveCan } from '~/modules/entities/use-resolve-can';
import type { EnrichedOrganization } from '~/modules/organization/types';
import { DeleteProjects } from '~/modules/project/delete-projects';
import type { EnrichedProject } from '~/modules/project/types';
import { UpdateProjectForm } from '~/modules/project/update-project-form';
import { Button } from '~/modules/ui/button';
import { ActorCell } from '~/modules/user/actor-cell';
import { cn } from '~/utils/cn';

const projectRoles = hierarchy.getRoles('project');
const projectProducts = hierarchy.getOrderedDescendants('project').filter(isProduct);

export const useColumns = (organization: EnrichedOrganization) => {
  const { t } = useTranslation();
  const resolveCan = useResolveCan();
  const organizationSlug = organization.slug;

  const columns: ColumnOrColumnGroup<EnrichedProject>[] = [
    CheckboxColumn,
    {
      key: 'name',
      name: t('c:name'),
      sortable: true,
      minWidth: 200,
      resizable: true,
      renderCell: ({ row, tabIndex }) => (
        <Button
          variant="cell"
          size="cell"
          render={
            <Link
              to="/$tenantId/$organizationSlug/project/$slug"
              draggable={false}
              tabIndex={tabIndex}
              params={{ tenantId: row.tenantId, organizationSlug, slug: row.slug }}
            />
          }
        >
          <EntityAvatar type="project" className="group-active/cell-button:press size-8" id={row.id} name={row.name} url={row.thumbnailUrl} />
          <span className={cn(cellLinkTextClass, 'font-medium')}>{row.name || '-'}</span>
        </Button>
      ),
    },
    ellipsisColumn<EnrichedProject>((row) => {
      const options: EllipsisOption<EnrichedProject>[] = [];
      if (resolveCan(row.can?.project?.update, row.createdBy)) {
        options.push({
          label: i18n.t('c:edit'),
          icon: PencilIcon,
          onSelect: (project, triggerRef) => {
            useDropdowner.getState().remove();
            openEditSheet({
              id: 'update-project',
              resource: 'c:project',
              triggerRef,
              children: <UpdateProjectForm project={project} />,
            });
          },
        });
      }
      if (resolveCan(row.can?.project?.delete, row.createdBy)) {
        options.push({
          label: i18n.t('c:delete'),
          icon: TrashIcon,
          onSelect: (project) => {
            const close = () => useDropdowner.getState().remove();
            openPopConfirm(
              <NamedText i18nKey="c:delete_confirm.text" name={project.name} />,
              <DeleteProjects projects={[project]} callback={close} />,
            );
          },
        });
      }
      return options;
    }),
    {
      key: 'public',
      name: t('c:public_access'),
      minBreakpoint: 'md',
      minWidth: 100,
      maxWidth: 160,
      renderCell: ({ row }) =>
        row.public ? (
          <>
            <GlobeIcon className="mr-2 opacity-50" />
            {t('c:public')}
          </>
        ) : (
          <>
            <LockIcon className="mr-2 opacity-50" />
            <span className="opacity-50">{t('c:private')}</span>
          </>
        ),
    },
    dateColumn<EnrichedProject>('lastPost', {
      name: t('c:last_post'),
      sortable: false,
      get: (row) => {
        const lastPost = row.included.counts?.activity.task.created;
        return lastPost ? new Date(lastPost) : null;
      },
    }),
    ...projectRoles.map((role) => ({
      ...countColumn<EnrichedProject>(`${role}Count`, {
        name: t(`c:${role}`, { count: 2 }),
        icon: role === 'admin' ? ShieldIcon : UserRoundIcon,
        hidden: role === 'guest',
        get: (row) => row.included.counts?.membership[role],
      }),
      maxWidth: 140,
    })),
    ...projectProducts.map((type) =>
      countColumn<EnrichedProject>(`${type}Count`, {
        name: t(`c:${type}`, { count: 2 }),
        icon: getMemberStatIcon(type),
        hidden: type === 'attachment',
        get: (row) => row.included.counts?.entities[type],
      }),
    ),
    dateColumn('createdAt', { name: t('c:created_at') }),
    {
      key: 'createdBy',
      name: t('c:created_by'),
      hidden: true,
      minWidth: 160,
      placeholderValue: '-',
      renderCell: ({ row, tabIndex }) => row.createdBy && <ActorCell compactable actor={row.createdBy} tabIndex={tabIndex} />,
    },
  ];

  return useColumnVisibility(columns);
};
