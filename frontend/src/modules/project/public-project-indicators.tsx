import { GlobeIcon } from 'lucide-react';
import { type ReactElement, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCan } from '~/modules/entities/use-can';
import { openProjectSettingsSheet } from '~/modules/project/project-actions';
import type { EnrichedProject } from '~/modules/project/types';
import { Badge, badgeVariants } from '~/modules/ui/badge';
import { Button } from '~/modules/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '~/modules/ui/popover';
import { cn } from '~/utils/cn';

interface PublicBadgeProps {
  /** For the page header's avatar. */
  large?: boolean;
  className?: string;
}

/** The globe at a public project avatar's bottom right. It hangs over the edge, so no ancestor up to the avatar's may clip. */
export function PublicBadge({ large, className }: PublicBadgeProps) {
  const { t } = useTranslation();

  return (
    <span
      role="img"
      aria-label={t('c:public_project')}
      className={cn(
        'absolute flex items-center justify-center rounded-full bg-foreground text-background ring-2 ring-background',
        large ? '-right-1.5 -bottom-1.5 size-5.5' : '-right-1.25 -bottom-1.25 size-4.5',
        className,
      )}
    >
      <GlobeIcon className={large ? 'size-3.5' : 'size-3'} />
    </span>
  );
}

interface PublicProjectPopoverProps {
  project: EnrichedProject;
  trigger: ReactElement;
}

/** Tells someone who can edit the project what public means and where to change it. */
function PublicProjectPopover({ project, trigger }: PublicProjectPopoverProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger ref={triggerRef} render={trigger} />
      <PopoverContent align="start" aria-label={t('c:public_project')} className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <GlobeIcon className="size-4 shrink-0" />
          {t('c:public_project')}
        </div>
        <p className="text-muted-foreground text-sm">{t('c:public_project.text')}</p>
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => {
            setIsOpen(false);
            openProjectSettingsSheet(project, triggerRef);
          }}
        >
          {t('c:edit_resource', { resource: t('c:project') })}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

interface PublicProjectLabelProps {
  /** The project, when the viewer can edit it: the text then opens the popover. */
  editableProject?: EnrichedProject;
}

/** "Public project" in place of "Project" in the page header's context line. */
export function PublicProjectLabel({ editableProject }: PublicProjectLabelProps) {
  const { t } = useTranslation();
  const label = t('c:public_project');

  if (!editableProject) return <span className="shrink-0 font-semibold text-foreground">{label}</span>;

  return (
    <PublicProjectPopover
      project={editableProject}
      trigger={
        // The context line clips: the ring sits in a padding the negative margin takes back
        <button
          type="button"
          className="focus-inset -m-1 shrink-0 cursor-pointer rounded-sm p-1 font-semibold text-foreground underline decoration-dotted underline-offset-3 hover:decoration-solid"
        >
          {label}
        </button>
      }
    />
  );
}

const chipClass = 'font-normal text-xs';

interface PublicProjectChipProps {
  project: EnrichedProject;
}

/** "Public" in a workspace panel head, in the spot of "Read only". */
export function PublicProjectChip({ project }: PublicProjectChipProps) {
  const { t } = useTranslation();
  const can = useCan();

  if (!can('update', 'project', project)) {
    return (
      <Badge soft className={chipClass}>
        {t('c:public')}
      </Badge>
    );
  }

  return (
    <PublicProjectPopover
      project={project}
      trigger={
        <button type="button" className={cn(badgeVariants({ soft: true }), chipClass, 'cursor-pointer hover:brightness-125')}>
          {t('c:public')}
        </button>
      }
    />
  );
}
