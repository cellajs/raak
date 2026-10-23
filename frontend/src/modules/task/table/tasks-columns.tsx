import { Link } from '@tanstack/react-router';
import { DotIcon, PaperclipIcon } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Organization, Project } from 'sdk';
import { exportDate } from '~/lib/export';
import type { RenderCellProps } from '~/modules/common/data-grid';
import { SelectColumn } from '~/modules/common/data-grid';
import { estimateWrappedLines } from '~/modules/common/data-grid/utils/wrap-text-utils';
import type { ColumnOrColumnGroup } from '~/modules/common/data-table/types';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { HighlightText } from '~/modules/common/match-highlight';
import { PrimaryLabelIcon } from '~/modules/label/primary-label-icon';
import { getSeenChannelId } from '~/modules/seen/helpers';
import { SeenMark } from '~/modules/seen/seen-mark';
import { TaskMatchReason } from '~/modules/task/card/task-match-reason';
import { TaskSummaryHtml } from '~/modules/task/card/task-summary-html';
import { openTaskSheet } from '~/modules/task/helpers/board-navigation';
import { statusOptionsByValue } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';
import { AvatarGroup, AvatarGroupList, AvatarOverflowIndicator } from '~/modules/ui/avatar';
import { Button } from '~/modules/ui/button';
import { ActorCell } from '~/modules/user/actor-cell';
import { dateShort } from '~/utils/date-short';

function SummaryCell({ row, tabIndex }: RenderCellProps<Task>) {
  const cellRef = useRef<HTMLButtonElement>(null);

  return (
    <Button
      id={`tasks-${row.id}`}
      ref={cellRef}
      variant="cell"
      tabIndex={tabIndex}
      className="group inline-flex h-auto w-full flex-wrap justify-start px-0 text-left opacity-100 outline-0 ring-0 focus-visible:ring-0"
      onKeyDown={(event) => {
        if (event.key === 'Enter') cellRef.current?.click();
      }}
      onClick={() => openTaskSheet(row.id)}
    >
      <div className="whitespace-pre-wrap py-1 leading-5">
        {row.summary ? <TaskSummaryHtml task={row} className="pointer-events-none" /> : <span className="text-muted">-</span>}
        <TaskMatchReason task={row} className="mt-1 whitespace-normal" />
      </div>
    </Button>
  );
}

interface ProjectCellProps {
  row: Task;
  tabIndex: number;
  projects: Project[];
  organization?: Organization;
  tenantId?: string;
}

function ProjectCell({ row, tabIndex, projects, organization, tenantId }: ProjectCellProps) {
  const project = projects.find(({ id }) => id === row.projectId);
  if (!project || !organization || !tenantId) return row.projectId;

  return (
    <Link
      to="/$tenantId/$organizationSlug/project/$slug"
      params={{ slug: project.slug, organizationSlug: organization.slug, tenantId }}
      tabIndex={tabIndex}
      className="group flex items-center space-x-2 truncate outline-0 ring-0"
      data-tooltip="compact"
      data-tooltip-content={project.name}
    >
      <EntityAvatar
        type="project"
        className="group-active:press h-8 w-8 group-hover:font-semibold"
        id={project.id}
        name={project.name}
        url={project.thumbnailUrl}
      />
      <span className="group-active:press in-data-[is-compact=true]:hidden truncate decoration-foreground/20 underline-offset-3 group-hover:underline group-active:decoration-foreground/50">
        {project.name}
      </span>
    </Link>
  );
}

/** Builds the column definitions for the enclosing table. */
export const useColumns = (opts: {
  hideProject: boolean;
  projects: Project[];
  organization?: Organization;
  tenantId?: string;
}): ColumnOrColumnGroup<Task>[] => {
  const { t } = useTranslation();

  return [
    { ...SelectColumn, key: 'checkbox-column', minBreakpoint: 'sm' },
    {
      key: 'primaryLabel',
      name: t('c:type'),
      minBreakpoint: 'sm',
      renderCell: ({ row }) => {
        if (!row.primaryLabel) return null;
        return (
          <>
            <span className="mr-2 inline-flex shrink-0" data-tooltip="compact" data-tooltip-content={row.primaryLabel.name}>
              <PrimaryLabelIcon label={row.primaryLabel} />
            </span>
            <span className="in-data-[is-compact=true]:hidden truncate">{row.primaryLabel.name}</span>
          </>
        );
      },
      width: 140,
      modes: {
        compact: { width: 32, minWidth: 32 },
        // On mobile the type icon merges into the summary cell (icon-only via the slot's data-is-compact)
        mobile: { merge: { into: 'summary', side: 'left' } },
      },
    },
    {
      key: 'summary',
      name: t('c:summary'),
      minWidth: 280,
      resizable: true,
      wrapText: 3,
      estimateLines: (row, { width }) => estimateWrappedLines(row.summaryLength ?? 0, width),
      renderCell: (props) => <SummaryCell {...props} />,
    },
    {
      key: 'todos',
      name: t('c:todo_other'),
      minBreakpoint: 'sm',
      width: 70,
      placeholderValue: '-',
      renderCell: ({ row }) => {
        const checked = row.checkedCount ?? 0;
        const total = row.checkboxCount ?? 0;
        if (total === 0) return null;
        return (
          <div className="inline-flex items-center gap-1">
            <span className="text-success">{checked}</span>
            <span className="opacity-50">/</span>
            <span>{total}</span>
          </div>
        );
      },
    },
    {
      key: 'attachments',
      name: t('c:attachment_other'),
      minBreakpoint: 'sm',
      width: 70,
      placeholderValue: '-',
      renderCell: ({ row }) => {
        const count = row.attachments?.length ?? 0;
        if (count === 0) return null;
        return (
          <div className="inline-flex items-center gap-1">
            <PaperclipIcon className="size-3 -rotate-45 opacity-50" />
            <span className="">{count}</span>
          </div>
        );
      },
    },
    {
      key: 'status',
      name: t('c:status'),
      sortable: true,
      minBreakpoint: 'sm',
      width: 140,
      renderCell: ({ row }) => {
        const status = statusOptionsByValue[row.status];
        return (
          <>
            <SeenMark
              productId={row.id}
              tenantId={row.tenantId}
              organizationId={row.organizationId}
              channelId={getSeenChannelId('task', row)}
              productType="task"
            />
            <status.icon className="mr-2 size-4 shrink-0" aria-hidden="true" />
            <span>{t(`c:${status.status}`)}</span>
          </>
        );
      },
    },
    {
      key: 'assignedTo',
      name: t('c:assigned_to'),
      hidden: true,
      width: 100,
      placeholderValue: '-',
      renderCell: ({ row }) => {
        if (!row.assignedTo.length) return null;
        return (
          <span className="inline-flex" data-tooltip="compact" data-tooltip-content={row.assignedTo.map((user) => user.name).join(', ')}>
            <AvatarGroup limit={3}>
              <AvatarGroupList>
                {row.assignedTo.map((user) => (
                  <EntityAvatar type="user" key={user.id} id={user.id} name={user.name} url={user.thumbnailUrl} className="h-8 w-8 text-xs" />
                ))}
              </AvatarGroupList>
              <AvatarOverflowIndicator className="h-8 w-8 text-xs" />
            </AvatarGroup>
          </span>
        );
      },
    },
    {
      key: 'labels',
      name: t('c:label_other'),
      hidden: true,
      width: 190,
      placeholderValue: '-',
      renderCell: ({ row }) => {
        if (!row.labels.length) return null;
        return (
          <div className="flex flex-col">
            {row.labels.map((label) => (
              <div key={label.id} className="flex items-center gap-1">
                <DotIcon className="size-2 shrink-0 rounded-md text-background" style={{ background: label.color || undefined }} strokeWidth={4} />
                <span className="text-xs">
                  <HighlightText text={label.name} />
                </span>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: 'projectId',
      name: t('c:project'),
      sortable: true,
      hidden: opts.hideProject,
      minBreakpoint: 'sm',
      width: 180,
      renderCell: ({ row, tabIndex }) => (
        <ProjectCell row={row} tabIndex={tabIndex} projects={opts.projects} organization={opts.organization} tenantId={opts.tenantId} />
      ),
      modes: { compact: { width: 50 } },
    },
    {
      key: 'createdBy',
      name: t('c:created_by'),
      sortable: true,
      minBreakpoint: 'sm',
      width: 180,
      placeholderValue: '-',
      renderCell: ({ row, tabIndex }) => row.createdBy && <ActorCell compactable actor={row.createdBy} tabIndex={tabIndex} />,
      // Compact toggle: creator avatar merges inline before the created date
      modes: { compact: { merge: { into: 'createdAt', side: 'left' } } },
    },
    {
      key: 'createdAt',
      name: t('c:created_at'),
      sortable: true,
      minBreakpoint: 'sm',
      width: 180,
      renderCell: ({ row }) => dateShort(row.createdAt),
      exportValue: (row) => exportDate(row.createdAt),
    },
    {
      key: 'updatedBy',
      name: t('c:updated_by'),
      hidden: true,
      width: 180,
      placeholderValue: '-',
      renderCell: ({ row, tabIndex }) => row.updatedBy && <ActorCell compactable actor={row.updatedBy} tabIndex={tabIndex} />,
      // Compact toggle: updater avatar merges inline before the updated date
      modes: { compact: { merge: { into: 'updatedAt', side: 'left' } } },
    },
    {
      key: 'updatedAt',
      name: t('c:updated_at'),
      sortable: true,
      hidden: true,
      width: 180,
      renderCell: ({ row }) => dateShort(row.updatedAt),
      exportValue: (row) => exportDate(row.updatedAt),
    },
  ];
};
