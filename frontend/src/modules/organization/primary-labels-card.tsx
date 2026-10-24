import { GripVerticalIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { type FormEvent, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Organization } from 'sdk';
import { labelColorTokens, labelSlug, type PrimaryLabelDefinition, primaryLabelLimits } from 'shared/config/labels-config';
import type { RowsChangeData } from '~/modules/common/data-grid';
import { EditCellInput } from '~/modules/common/data-grid/cell-renderers';
import { DataTable } from '~/modules/common/data-table/data-table';
import type { ColumnOrColumnGroup } from '~/modules/common/data-table/types';
import { NamedText } from '~/modules/common/named-text';
import { openConfirm } from '~/modules/common/open-confirm';
import { Spinner } from '~/modules/common/spinner';
import { ToolCard } from '~/modules/common/tool-card';
import { isLabelColorToken, labelPalette } from '~/modules/label/label-palette';
import { PrimaryLabelIcon } from '~/modules/label/primary-label-icon';
import { useOrganizationUpdateMutation } from '~/modules/organization/query';
import { Button } from '~/modules/ui/button';
import { Input } from '~/modules/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '~/modules/ui/popover';
import { cn } from '~/utils/cn';
import { lazyNamed } from '~/utils/lazy-named';
import { tw } from '~/utils/tw';

const centeredCellClass = tw('flex items-center justify-center');

const IconPicker = lazyNamed(() => import('~/modules/common/icon-picker/icon-picker'), 'IconPicker');

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
        <PrimaryLabelIcon label={row} className="size-4" />
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
        <span className={cn('size-4 rounded-full', isLabelColorToken(row.color) ? labelPalette[row.color].dot : 'bg-muted')} />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" onMouseDown={(event) => event.stopPropagation()}>
        <div className="grid grid-cols-7 gap-1">
          {labelColorTokens.map((token) => (
            <button
              key={token}
              type="button"
              title={token}
              aria-label={token}
              onClick={() => {
                setOpen(false);
                onRowChange({ ...row, color: token });
              }}
              className={cn('flex items-center justify-center rounded-md p-1.5 hover:bg-accent', row.color === token && 'bg-accent ring-1 ring-ring')}
            >
              <span className={cn('size-4 rounded-full', labelPalette[token].dot)} />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface PrimaryLabelsCardProps {
  organization: Organization;
}

/**
 * Admin card for the organization's primary labels (setupConfig.primaryLabels), the task types provisioned into every
 * new project. Slugs derive from the name on add and then stay fixed: organization tracking matches on them.
 */
export function PrimaryLabelsCard({ organization }: PrimaryLabelsCardProps) {
  const { t } = useTranslation();
  const { mutate, isPending } = useOrganizationUpdateMutation();

  const rows = organization.setupConfig.primaryLabels;
  const [newName, setNewName] = useState('');
  const trimmedName = newName.trim();
  const canAdd = rows.length < primaryLabelLimits.max && !!trimmedName && !isPending;

  const persist = (primaryLabels: PrimaryLabelDefinition[]) =>
    mutate({
      path: { tenantId: organization.tenantId, id: organization.id },
      body: { setupConfig: { primaryLabels } },
    });

  const handleRowsChange = (changed: PrimaryLabelDefinition[], { indexes, column }: RowsChangeData<PrimaryLabelDefinition>) => {
    const index = indexes[0];
    if (column.key === 'name') {
      const name = changed[index].name.trim();
      // Skipping persist reverts the edit on close
      if (!name || name === rows[index].name) return;
      persist(changed.with(index, { ...changed[index], name }));
      return;
    }
    if (column.key === 'icon' || column.key === 'color') persist(changed);
  };

  const handleRowReorder = (fromIdx: number, toIdx: number, edge: 'top' | 'bottom') => {
    const next = [...rows];
    const [moved] = next.splice(fromIdx, 1);
    let insertAt = edge === 'bottom' ? toIdx + 1 : toIdx;
    if (fromIdx < insertAt) insertAt -= 1;
    next.splice(insertAt, 0, moved);
    persist(next);
  };

  // The slug comes from the typed name: projects' copies keep a removed type's slug, so adding it again relinks them
  const addEntry = (event: FormEvent) => {
    event.preventDefault();
    if (!canAdd) return;
    const slugBase = labelSlug(trimmedName) || 'label';
    let slug = slugBase;
    for (let i = 2; rows.some((row) => row.slug === slug); i++) slug = `${slugBase}-${i}`;
    persist([...rows, { slug, name: trimmedName, color: 'blue', icon: null }]);
    setNewName('');
  };

  const confirmRemove = (row: PrimaryLabelDefinition, trigger: HTMLButtonElement) =>
    openConfirm(trigger, {
      id: `remove-task-type-${row.slug}`,
      title: <NamedText i18nKey="c:remove_task_type.text" name={row.name} />,
      label: 'c:remove',
      onConfirm: () => persist(rows.filter((entry) => entry.slug !== row.slug)),
    });

  const columns: ColumnOrColumnGroup<PrimaryLabelDefinition>[] = [
    {
      key: 'drag-handle',
      name: '',
      width: 32,
      maxWidth: 32,
      cellClass: cn(centeredCellClass, 'cursor-grab'),
      rowDragHandle: true,
      renderCell: () => <GripVerticalIcon className="size-3.5 text-muted-foreground/50" />,
    },
    {
      key: 'icon',
      name: t('c:icon'),
      width: 56,
      cellClass: centeredCellClass,
      headerCellClass: 'text-center',
      renderCell: ({ row, onRowChange }) => <IconCell row={row} onRowChange={onRowChange} />,
    },
    {
      key: 'color',
      name: t('c:color'),
      width: 56,
      cellClass: centeredCellClass,
      headerCellClass: 'text-center',
      renderCell: ({ row, onRowChange }) => <ColorCell row={row} onRowChange={onRowChange} />,
    },
    {
      key: 'name',
      name: t('c:name'),
      minWidth: 140,
      renderCell: ({ row }) => <span className="truncate">{row.name}</span>,
      renderEditCell: ({ row, onRowChange }) => (
        <EditCellInput value={row.name} onChange={(event) => onRowChange({ ...row, name: event.target.value })} autoFocus />
      ),
    },
    {
      key: 'remove',
      name: '',
      width: 32,
      maxWidth: 32,
      cellClass: centeredCellClass,
      renderCell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('c:remove')}
          disabled={rows.length <= primaryLabelLimits.min}
          onClick={({ currentTarget }) => confirmRemove(row, currentTarget)}
        >
          <Trash2Icon className="size-3.5" />
        </Button>
      ),
    },
  ];

  // No DOM id equal to the section id: the scroll spy owns `spy-` prefixed anchors, and a bare
  // `task-types` element would native-anchor on hash load underneath the sticky header
  return (
    <ToolCard label="c:primary_labels" description={t('c:primary_labels.text')}>
      <form onSubmit={addEntry} className="mb-3 flex gap-2">
        <Input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder={t('c:new_task_type')}
          aria-label={t('c:new_task_type')}
          disabled={rows.length >= primaryLabelLimits.max}
          className="sm:max-w-64"
        />
        <Button type="submit" variant="outline" disabled={!canAdd}>
          <PlusIcon className="size-3.5" />
          {t('c:add')}
        </Button>
      </form>
      <DataTable
        rows={rows}
        rowKeyGetter={rowKeyGetter}
        columns={columns}
        hasNextPage={false}
        readOnly
        cellSelectionMode="cell"
        enableVirtualization={false}
        className="mb-0"
        onRowsChange={handleRowsChange}
        onRowReorder={handleRowReorder}
        onCellClick={({ column, selectCell }) => {
          if (column.key === 'name') selectCell(true);
        }}
      />
    </ToolCard>
  );
}
