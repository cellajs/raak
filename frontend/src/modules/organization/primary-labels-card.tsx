import { GripVerticalIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Organization } from 'sdk';
import { labelSlug, type PrimaryLabelDefinition, primaryLabelLimits } from 'shared';
import type { RowsChangeData } from '~/modules/common/data-grid';
import { EditCellInput } from '~/modules/common/data-grid/cell-renderers';
import { DataTable } from '~/modules/common/data-table/data-table';
import type { ColumnOrColumnGroup } from '~/modules/common/data-table/types';
import { Spinner } from '~/modules/common/spinner';
import { ToolCard } from '~/modules/common/tool-card';
import { isLabelColorToken, labelPalette } from '~/modules/label/label-palette';
import { PrimaryLabelIcon } from '~/modules/label/primary-label-icon';
import { useOrganizationUpdateMutation } from '~/modules/organization/query';
import { Button } from '~/modules/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '~/modules/ui/popover';
import { cn } from '~/utils/cn';

const IconPicker = lazy(() =>
  import('~/modules/common/icon-picker/icon-picker').then((m) => ({ default: m.IconPicker })),
);

/** Stable row key getter, defined outside the component to keep its identity stable. */
function rowKeyGetter(row: PrimaryLabelDefinition) {
  return row.slug;
}

interface PickerCellProps {
  row: PrimaryLabelDefinition;
  onRowChange: (row: PrimaryLabelDefinition) => void;
}

function IconCell({ row, onRowChange }: PickerCellProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label={t('c:icon')} />}>
        <PrimaryLabelIcon label={row} className="icon-md" />
      </PopoverTrigger>
      {/* Portal events bubble through the React tree into the host gridcell, whose mousedown
          steals focus and dismisses the popup before click; stop them at the popup boundary */}
      <PopoverContent className="w-auto p-2" onMouseDown={(event) => event.stopPropagation()}>
        <Suspense fallback={<Spinner />}>
          <IconPicker
            value={row.icon}
            onChange={(icon) => {
              setOpen(false);
              onRowChange({ ...row, icon });
            }}
          />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}

function ColorCell({ row, onRowChange }: PickerCellProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label={t('c:color')} />}>
        <span
          className={cn('size-4 rounded-full', isLabelColorToken(row.color) ? labelPalette[row.color].dot : 'bg-muted')}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" onMouseDown={(event) => event.stopPropagation()}>
        <div className="grid grid-cols-7 gap-1">
          {Object.entries(labelPalette).map(([token, palette]) => (
            <button
              key={token}
              type="button"
              title={token}
              aria-label={token}
              onClick={() => {
                setOpen(false);
                onRowChange({ ...row, color: token as PrimaryLabelDefinition['color'] });
              }}
              className={cn(
                'flex items-center justify-center rounded-md p-1.5 hover:bg-accent',
                row.color === token && 'bg-accent ring-1 ring-ring',
              )}
            >
              <span className={cn('size-4 rounded-full', palette.dot)} />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface Props {
  organization: Organization;
}

/**
 * Admin card managing the organization's primary label set (setupConfig.primaryLabels): the task
 * types provisioned into every new project, in a data grid with drag reorder and in-place cell
 * editing. Every interaction persists immediately. Slugs are derived from the name on add and stay
 * stable afterwards, since they are the identity that organization tracking matches on.
 */
export function PrimaryLabelsCard({ organization }: Props) {
  const { t } = useTranslation();
  const { mutate, isPending } = useOrganizationUpdateMutation();

  const rows = organization.setupConfig.primaryLabels;

  const persist = (primaryLabels: PrimaryLabelDefinition[]) =>
    mutate({
      path: { tenantId: organization.tenantId, id: organization.id },
      body: { setupConfig: { primaryLabels } },
    });

  const onRowsChange = (
    changed: PrimaryLabelDefinition[],
    { indexes, column }: RowsChangeData<PrimaryLabelDefinition>,
  ) => {
    const index = indexes[0];
    if (column.key === 'name') {
      const name = changed[index].name.trim();
      // Backend validNameSchema requires 2+ chars; skipping persist reverts the edit on close
      if (name.length < 2 || name === rows[index].name) return;
      persist(changed.with(index, { ...changed[index], name }));
      return;
    }
    if (column.key === 'icon' || column.key === 'color') persist(changed);
  };

  const onRowReorder = (fromIdx: number, toIdx: number, edge: 'top' | 'bottom') => {
    const next = [...rows];
    const [moved] = next.splice(fromIdx, 1);
    let insertAt = edge === 'bottom' ? toIdx + 1 : toIdx;
    if (fromIdx < insertAt) insertAt -= 1;
    next.splice(insertAt, 0, moved);
    persist(next);
  };

  const addEntry = () => {
    const name = t('c:label');
    const slugBase = labelSlug(name) || 'label';
    // Slugs are identity: suffix until unique within the set
    let slug = slugBase;
    for (let i = 2; rows.some((row) => row.slug === slug); i++) slug = `${slugBase}-${i}`;
    persist([...rows, { slug, name, color: 'blue', icon: null }]);
  };

  const columns: ColumnOrColumnGroup<PrimaryLabelDefinition>[] = [
    {
      key: 'drag-handle',
      name: '',
      width: 32,
      maxWidth: 32,
      cellClass: 'cursor-grab flex items-center justify-center',
      rowDragHandle: true,
      renderCell: () => <GripVerticalIcon className="icon-sm text-muted-foreground/50" />,
    },
    {
      key: 'icon',
      name: t('c:icon'),
      width: 56,
      cellClass: 'flex items-center justify-center',
      headerCellClass: 'text-center',
      renderCell: ({ row, onRowChange }) => <IconCell row={row} onRowChange={onRowChange} />,
    },
    {
      key: 'color',
      name: t('c:color'),
      width: 56,
      cellClass: 'flex items-center justify-center',
      headerCellClass: 'text-center',
      renderCell: ({ row, onRowChange }) => <ColorCell row={row} onRowChange={onRowChange} />,
    },
    {
      key: 'name',
      name: t('c:name'),
      minWidth: 140,
      renderCell: ({ row }) => <span className="truncate">{row.name}</span>,
      renderEditCell: ({ row, onRowChange }) => (
        <EditCellInput value={row.name} onChange={(e) => onRowChange({ ...row, name: e.target.value })} autoFocus />
      ),
    },
    {
      key: 'remove',
      name: '',
      width: 32,
      maxWidth: 32,
      cellClass: 'flex items-center justify-center',
      renderCell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('c:remove')}
          disabled={rows.length <= primaryLabelLimits.min}
          onClick={() => persist(rows.filter((entry) => entry.slug !== row.slug))}
        >
          <Trash2Icon className="icon-sm" />
        </Button>
      ),
    },
  ];

  // No DOM id equal to the section id: the scroll spy owns `spy-` prefixed anchors, and a bare
  // `task-types` element would native-anchor on hash load underneath the sticky header
  return (
    <ToolCard label="c:primary_labels" description={t('c:primary_labels.text')}>
      <Button
        variant="outline"
        size="sm"
        className="mb-3"
        disabled={rows.length >= primaryLabelLimits.max || isPending}
        onClick={addEntry}
      >
        <PlusIcon className="icon-sm" />
        {t('c:add')}
      </Button>
      <DataTable
        rows={rows}
        rowKeyGetter={rowKeyGetter}
        columns={columns}
        hasNextPage={false}
        readOnly
        cellSelectionMode="cell"
        enableVirtualization={false}
        className="mb-0"
        onRowsChange={onRowsChange}
        onRowReorder={onRowReorder}
        onCellClick={({ column, selectCell }) => {
          if (column.key === 'name') selectCell(true);
        }}
      />
    </ToolCard>
  );
}
