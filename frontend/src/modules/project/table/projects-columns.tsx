import { Link } from '@tanstack/react-router';
import i18n from 'i18next';
import { BoxIcon, GlobeIcon, PencilIcon, ShieldIcon, TrashIcon, UserRoundIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { hierarchy, isProduct } from 'shared';
import { getMemberStatIcon } from '~/lib/entity-modules';
import { ConfirmText } from '~/modules/common/confirm-text';
import { CheckboxColumn } from '~/modules/common/data-table/checkbox-column';
import { dateColumn, ellipsisColumn } from '~/modules/common/data-table/columns';
import type { EllipsisOption } from '~/modules/common/data-table/table-ellipsis';
import type { ColumnOrColumnGroup } from '~/modules/common/data-table/types';
import { useDropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { openPopConfirm } from '~/modules/common/popconfirm';
import { openEditSheet } from '~/modules/common/sheeter/open-edit-sheet';
import type { EnrichedOrganization } from '~/modules/organization/types';
import { DeleteProjects } from '~/modules/project/delete-projects';
import { canOnProject } from '~/modules/project/table/can-on-project';
import type { EnrichedProject } from '~/modules/project/types';
import { UpdateProjectForm } from '~/modules/project/update-project-form';
import { Button } from '~/modules/ui/button';
import { UserCell } from '~/modules/user/user-cell';
import { useUserStore } from '~/modules/user/user-store';

const projectRoles = hierarchy.getRoles('project');
const projectProducts = hierarchy.getOrderedDescendants('project').filter(isProduct);

export const useColumns = (organization: EnrichedOrganization) => {
  const { t } = useTranslation();
  const userId = useUserStore((state) => state.user?.id);
  const organizationSlug = organization.slug;
  const organizationCan = organization.can;

  return useMemo(
    (): ColumnOrColumnGroup<EnrichedProject>[] => [
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
            <span className="group-active/cell-button:press link-decoration group-active/cell-button:link-decoration-strong truncate font-medium group-hover/cell-button:underline">
              {row.name || '-'}
            </span>
          </Button>
        ),
      },
      ellipsisColumn<EnrichedProject>((row) => {
        const options: EllipsisOption<EnrichedProject>[] = [];
        if (canOnProject('update', row, organizationCan, userId)) {
          options.push({
            label: i18n.t('c:edit'),
            icon: PencilIcon,
            onSelect: (project, triggerRef) => {
              useDropdowner.getState().remove();
              openEditSheet({
                id: 'update-project',
                resource: 'c:project',
                triggerRef,
                children: <UpdateProjectForm project={project} sheet />,
              });
            },
          });
        }
        if (canOnProject('delete', row, organizationCan, userId)) {
          options.push({
            label: i18n.t('c:delete'),
            icon: TrashIcon,
            onSelect: (project) => {
              const close = () => useDropdowner.getState().remove();
              openPopConfirm(
                <ConfirmText i18nKey="c:delete_confirm.text" values={{ name: project.name }} />,
                <DeleteProjects projects={[project]} callback={close} onCancel={close} />,
              );
            },
          });
        }
        return options;
      }),
      {
        key: 'publicAt',
        name: t('c:public_access'),
        minBreakpoint: 'md',
        minWidth: 100,
        maxWidth: 160,
        renderCell: ({ row }) =>
          row.publicAt ? (
            <>
              <GlobeIcon className="mr-2 opacity-50" />
              {t('c:public')}
            </>
          ) : (
            <span className="opacity-50">{t('c:private')}</span>
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
      ...projectRoles.map(
        (role): ColumnOrColumnGroup<EnrichedProject> => ({
          key: `${role}Count`,
          name: t(`c:${role}`, { count: 2 }),
          hidden: role === 'guest',
          minBreakpoint: 'md',
          minWidth: 60,
          maxWidth: 140,
          renderCell: ({ row }) => (
            <>
              {role === 'admin' ? <ShieldIcon className="mr-2 opacity-50" /> : <UserRoundIcon className="mr-2 opacity-50" />}
              {row.included.counts?.membership[role] ?? '-'}
            </>
          ),
        }),
      ),
      ...projectProducts.map((type): ColumnOrColumnGroup<EnrichedProject> => {
        const Icon = getMemberStatIcon(type) ?? BoxIcon;
        return {
          key: `${type}Count`,
          name: t(`c:${type}`, { count: 2 }),
          hidden: type === 'attachment',
          minBreakpoint: 'md',
          minWidth: 60,
          maxWidth: 120,
          renderCell: ({ row }) => (
            <>
              <Icon className="mr-2 opacity-50" />
              {row.included.counts?.entities[type] ?? '-'}
            </>
          ),
        };
      }),
      dateColumn('createdAt', { name: t('c:created_at') }),
      {
        key: 'createdBy',
        name: t('c:created_by'),
        hidden: true,
        minWidth: 160,
        placeholderValue: '-',
        renderCell: ({ row, tabIndex }) => row.createdBy && <UserCell compactable user={row.createdBy} tabIndex={tabIndex} />,
      },
    ],
    [t, userId, organizationSlug, organizationCan],
  );
};
