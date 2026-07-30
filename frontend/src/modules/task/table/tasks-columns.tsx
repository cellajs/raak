import { Link, useNavigate } from '@tanstack/react-router';
import { DotIcon, PaperclipIcon } from 'lucide-react';
import { createContext, useContext, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Organization, Project } from 'sdk';
import { zUserMinimalBase } from 'sdk/zod.gen';
import { BlockNoteMinimalHtml } from '~/modules/common/blocknote/minimal-html';
import type { RenderCellProps } from '~/modules/common/data-grid';
import { estimateWrappedLines, SelectColumn } from '~/modules/common/data-grid';
import type { ColumnOrColumnGroup } from '~/modules/common/data-table/types';
import type { TriggerRef } from '~/modules/common/dialoger/use-dialoger';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { PrimaryLabelIcon } from '~/modules/label/primary-label-icon';
import { getSeenChannelId } from '~/modules/seen/helpers';
import { SeenMark } from '~/modules/seen/seen-mark';
import { statusOptionsByValue } from '~/modules/task/task-properties';
import { statusFillColors } from '~/modules/task/task-styles';
import type { Task } from '~/modules/task/types';
import { AvatarGroup, AvatarGroupList, AvatarOverflowIndicator } from '~/modules/ui/avatar';
import { Button } from '~/modules/ui/button';
import { UserCell } from '~/modules/user/user-cell';
import { dateShort } from '~/utils/date-short';

// The creator/updater cells parse the same row object on every render; under virtualization that
// re-fires on scroll for rows already on screen. Cache the parse per user object: a row's identity
// from the query cache changes only when the row updates, so this runs once per distinct value.
type ParsedUserCell = ReturnType<typeof zUserMinimalBase.parse>;
const userCellCache = new WeakMap<object, ParsedUserCell | null>();
const parseUserCell = (value: unknown): ParsedUserCell | null => {
  if (!value || typeof value !== 'object') return null;
  const cached = userCellCache.get(value);
  if (cached !== undefined) return cached;
  const result = zUserMinimalBase.safeParse(value);
  const user = result.success ? result.data : null;
  userCellCache.set(value, user);
  return user;
};

function SummaryCell({
  row,
  tabIndex,
  navigate,
  setTriggerRef,
}: RenderCellProps<Task> & {
  navigate: ReturnType<typeof useNavigate>;
  setTriggerRef: (id: string, ref: TriggerRef) => void;
}) {
  const cellRef = useRef<HTMLButtonElement | null>(null);

  return (
    <Button
      id={`tasks-${row.id}`}
      ref={cellRef}
      variant="cell"
      tabIndex={tabIndex}
      className="group inline-flex h-auto w-full flex-wrap justify-start px-0 text-left outline-0 ring-0 focus-visible:ring-0"
      onKeyDown={(e) => {
        if (e.key === 'Enter') cellRef.current?.click();
      }}
      onClick={() => {
        // Store trigger to bring focus back
        setTriggerRef(row.id, cellRef);

        navigate({
          to: '.',
          replace: false,
          resetScroll: false,
          search: (prev) => ({ ...prev, taskSheetId: row.id }),
        });
      }}
    >
      <div className="whitespace-pre-wrap py-1 leading-5">
        {row.summary ? (
          <BlockNoteMinimalHtml html={row.summary} className="pointer-events-none" />
        ) : (
          <span className="text-muted">-</span>
        )}
      </div>
    </Button>
  );
}

/**
 * Supplies current projects to memoized cells.
 * Context keeps cold-load updates visible after column definitions are frozen.
 */
export const TableProjectsContext = createContext<Project[]>([]);

function ProjectCell({
  row,
  tabIndex,
  organization,
  tenantId,
}: {
  row: Task;
  tabIndex: number;
  organization?: Organization;
  tenantId?: string;
}) {
  const projects = useContext(TableProjectsContext);
  const project = projects.find((p) => p.id === row.projectId);
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
        className="h-8 w-8 group-hover:font-semibold group-active:translate-y-[.05rem]"
        id={project.id}
        name={project.name}
        url={project.thumbnailUrl}
      />
      <span className="in-data-[is-compact=true]:hidden truncate decoration-foreground/20 underline-offset-3 group-hover:underline group-active:translate-y-[.05rem] group-active:decoration-foreground/50">
        {project.name}
      </span>
    </Link>
  );
}

/** Builds the column definitions for the enclosing table. */
export const useColumns = (opts?: { hideProject?: boolean; organization?: Organization; tenantId?: string }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const setTriggerRef = useDialoger((state) => state.setTriggerRef);

  // Build once to preserve column-management state; changing project data comes from context.
  return useState<ColumnOrColumnGroup<Task>[]>(() => {
    const cols: ColumnOrColumnGroup<Task>[] = [
      {
        ...SelectColumn,
        key: 'checkbox-column',
        minBreakpoint: 'sm',
      },
      {
        key: 'primaryLabel',
        name: t('c:type'),
        minBreakpoint: 'sm',
        renderCell: ({ row }) => {
          if (!row.primaryLabel) return null;
          return (
            <>
              <span
                className="mr-2 inline-flex shrink-0"
                data-tooltip="compact"
                data-tooltip-content={row.primaryLabel.name}
              >
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
        renderCell: (props) => <SummaryCell {...props} navigate={navigate} setTriggerRef={setTriggerRef} />,
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
              <PaperclipIcon className="icon-xs -rotate-45 opacity-50" />
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
              <status.icon
                className={`mr-2 size-4 shrink-0 fill-current ${statusFillColors[row.status]}`}
                aria-hidden="true"
              />
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
            <span
              className="inline-flex"
              data-tooltip="compact"
              data-tooltip-content={row.assignedTo.map((user) => user.name).join(', ')}
            >
              <AvatarGroup limit={3}>
                <AvatarGroupList>
                  {row.assignedTo.map((user) => (
                    <EntityAvatar
                      type="user"
                      key={user.id}
                      id={user.id}
                      name={user.name}
                      url={user.thumbnailUrl}
                      className="h-8 w-8 text-xs"
                    />
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
                  <DotIcon
                    className="size-2 shrink-0 rounded-md text-background"
                    style={{ background: label.color || undefined }}
                    strokeWidth={4}
                  />
                  <span className="text-xs">{label.name}</span>
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
        hidden: opts?.hideProject,
        minBreakpoint: 'sm',
        width: 180,
        renderCell: ({ row, tabIndex }) => (
          <ProjectCell row={row} tabIndex={tabIndex} organization={opts?.organization} tenantId={opts?.tenantId} />
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
        renderCell: ({ row, tabIndex }) => {
          const user = parseUserCell(row.createdBy);
          if (!user) return null;
          return <UserCell compactable user={user} tabIndex={tabIndex} />;
        },
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
      },
      {
        key: 'updatedBy',
        name: t('c:updated_by'),
        hidden: true,
        width: 180,
        placeholderValue: '-',
        renderCell: ({ row, tabIndex }) => {
          const user = parseUserCell(row.updatedBy);
          if (!user) return null;
          return <UserCell compactable user={user} tabIndex={tabIndex} />;
        },
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
      },
    ];
    return cols;
  });
};
