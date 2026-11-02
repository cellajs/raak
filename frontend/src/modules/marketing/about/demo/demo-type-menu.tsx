import { SearchIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { NamedText } from '~/modules/common/named-text';
import { PrimaryLabelIcon } from '~/modules/label/primary-label-icon';
import { demoTypes } from '~/modules/marketing/about/demo/fixtures';
import { comboboxRowClass, HotkeyIndexBadge } from '~/modules/task/dropdowns/combobox-parts';
import type { Task } from '~/modules/task/types';
import { DrawerLead } from '~/modules/ui/drawer';
import { Kbd } from '~/modules/ui/kbd';
import { cn } from '~/utils/cn';

export const demoTypeMenuHeight = 170;

export interface DemoTypeMenuAnchor {
  x: number;
  y: number;
  above: boolean;
}

interface DemoTypeMenuProps {
  task: Task;
  highlightedId: string;
  /** Beside the type button, in the frame's coordinates; absent on a phone, where the sheet stands at the frame's foot. */
  anchor?: DemoTypeMenuAnchor;
}

/** The type picker's look without its behavior: the real overlays take focus and lock the page, which a demo playing by itself must not do. */
export function DemoTypeMenu({ task, highlightedId, anchor }: DemoTypeMenuProps) {
  const { t } = useTranslation();

  const rows = demoTypes.map((type, index) => (
    <div
      key={type.id}
      data-demo-type={type.slug}
      className={cn(
        'relative flex w-full select-none items-center gap-2 rounded-sm px-3 py-1.5 text-sm [&_svg:not([class*=size-])]:size-4 [&_svg]:shrink-0',
        comboboxRowClass,
        type.id === task.primaryLabelId && 'font-medium',
        type.id === highlightedId && 'bg-accent text-accent-foreground',
      )}
    >
      <PrimaryLabelIcon label={type} />
      <div className="grow">{type.name}</div>
      <HotkeyIndexBadge index={index} />
    </div>
  ));

  if (anchor) {
    return (
      <motion.div
        className="absolute z-91 w-48 rounded-md border bg-popover text-popover-foreground shadow-md"
        style={{ left: anchor.x, top: anchor.y, translate: anchor.above ? '0 -100%' : undefined }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
      >
        <div className="relative flex h-10 items-center gap-2 border-b px-3 text-faint-foreground text-sm">
          <SearchIcon className="size-4" />
          {t('c:select_resource', { resource: t('c:type') })}
          <Kbd className="absolute top-2.5 right-2.5">Alt T</Kbd>
        </div>
        <div className="p-1">{rows}</div>
      </motion.div>
    );
  }

  return (
    <>
      <motion.div
        className="absolute inset-0 z-90 bg-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      />
      <motion.div
        className="absolute inset-x-0 bottom-0 z-91 rounded-t-lg bg-background"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <div className="flex justify-center py-2">
          <div className="h-1 w-20 rounded-full bg-muted" />
        </div>
        <div className="flex flex-col gap-2 p-4 pt-0">
          <DrawerLead>
            <NamedText i18nKey="c:change_field.text" name={task.name} values={{ field: t('c:type') }} />
          </DrawerLead>
          <div className="p-1">{rows}</div>
        </div>
      </motion.div>
    </>
  );
}
