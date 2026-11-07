import { useQueries } from '@tanstack/react-query';
import { CircleCheckIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Label } from 'sdk';
import { generateId } from 'shared/utils/entity-id';
import { dropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { representsEpic } from '~/modules/label/group-labels';
import { labelTileStore } from '~/modules/label/label-tile-store';
import { labelsCanonicalOptions, useLabelCreateMutation, useLabelUpdateMutation } from '~/modules/label/query';
import type { LabelRow } from '~/modules/label/types';
import { findProjectByIdOrSlug } from '~/modules/project/query';
import { useReadOnlyProjectIds } from '~/modules/project/use-read-only';
import { Button } from '~/modules/ui/button';
import { Checkbox } from '~/modules/ui/checkbox';
import { cn } from '~/utils/cn';

type EpicTemplate = Pick<LabelRow, 'tenantId' | 'organizationId' | 'name' | 'slug' | 'color' | 'icon'>;

// Module-scoped so its identity is stable: useQueries recombines whenever the function changes
const combineLabels = (results: { data?: { items: Label[] } }[]) => results.flatMap((result) => result.data?.items ?? []);

/** The tags and epics with `slug` in `projectIds`, live from each project's label list, so a check shows its result at once. */
const useSlugLabels = ({ tenantId, organizationId, slug }: EpicTemplate, projectIds: string[]) =>
  useQueries({
    queries: projectIds.map((projectId) => labelsCanonicalOptions({ organizationId, tenantId, projectId })),
    combine: combineLabels,
  }).filter((label) => label.slug === slug && label.mode !== 'primary');

/** Moves a slug between tag and epic per project; a label is per project, so an epic over several projects is one label in each. */
const useEpicMode = ({ tenantId, organizationId }: Pick<LabelRow, 'tenantId' | 'organizationId'>) => {
  const { mutate: updateLabel } = useLabelUpdateMutation(tenantId, organizationId);
  const { mutate: createLabel } = useLabelCreateMutation(tenantId, organizationId);

  /**
   * Makes the slug an epic in exactly `projectIds`: a tag there becomes the epic, a project without the slug gets a new label, and the
   * epic in any other project goes back to a tag. A leaving row that holds the description hands it to a staying epic first.
   */
  const setEpicProjects = (template: EpicTemplate, slugLabels: Label[], projectIds: string[]) => {
    const epics = slugLabels.filter(({ mode }) => mode === 'epic');
    const staying = epics.filter(({ projectId }) => projectIds.includes(projectId));
    const home = epics.reduce<Label | undefined>((best, label) => (!best || representsEpic(label, best) ? label : best), undefined);
    const heir = staying.reduce<Label | undefined>((oldest, label) => (!oldest || label.createdAt < oldest.createdAt ? label : oldest), undefined);
    if (home?.description && heir && !projectIds.includes(home.projectId) && !heir.description) {
      updateLabel({ id: heir.id, ops: { description: home.description } });
    }

    for (const projectId of projectIds) {
      if (epics.some((label) => label.projectId === projectId)) continue;
      const tag = slugLabels.find((label) => label.projectId === projectId && label.mode === 'secondary');
      if (tag) updateLabel({ id: tag.id, ops: { mode: 'epic' } });
      else
        createLabel({
          id: generateId(),
          name: template.name,
          mode: 'epic',
          slug: template.slug,
          color: template.color,
          icon: template.icon,
          projectId,
        });
    }
    for (const label of epics) {
      if (!projectIds.includes(label.projectId)) updateLabel({ id: label.id, ops: { mode: 'secondary' } });
    }
  };

  /** Turns every label of the epic back into a tag; their tasks keep it, and each keeps its description should it become an epic again. */
  const closeEpic = (row: LabelRow) => {
    for (const id of row.siblingIds) updateLabel({ id, ops: { mode: 'secondary' } });
  };

  return { setEpicProjects, closeEpic };
};

interface EpicProjectsPickerProps {
  template: EpicTemplate;
  /** Making an epic waits for its button; editing an existing one applies each check at once. */
  mode: 'make' | 'edit';
  /** The projects the slug can live in, in board order. */
  scopeProjectIds: string[];
  /** Open tasks per project, for the clicked row's projects. */
  usage: Record<string, number>;
}

function EpicProjectsPicker({ template, mode, scopeProjectIds, usage }: EpicProjectsPickerProps) {
  const { t } = useTranslation();
  const slugLabels = useSlugLabels(template, scopeProjectIds);
  const readOnlyProjectIds = useReadOnlyProjectIds(scopeProjectIds);
  const { setEpicProjects } = useEpicMode(template);

  const projectsOf = (labelMode: Label['mode']) => slugLabels.filter(({ mode: other }) => other === labelMode).map(({ projectId }) => projectId);
  const [picked, setPicked] = useState(() => projectsOf('secondary'));
  const checked = mode === 'edit' ? projectsOf('epic') : picked;

  const toggle = (projectId: string) => {
    const next = checked.includes(projectId) ? checked.filter((other) => other !== projectId) : [...checked, projectId];
    if (mode === 'make') return setPicked(next);
    // The last project stays: without it the epic is gone, which Close as epic does
    if (next.length) setEpicProjects(template, slugLabels, next);
  };

  const close = () => dropdowner.getState().remove();

  return (
    <div className="flex w-76 max-w-full flex-col p-1">
      <p className="text-muted-foreground px-2 pt-1.5 pb-1 text-xs">
        {t(mode === 'make' ? 'c:make_epic_in' : 'c:epic_in_projects', { name: template.name })}
      </p>
      {scopeProjectIds.map((projectId) => {
        const project = findProjectByIdOrSlug(projectId, template.tenantId);
        const isChecked = checked.includes(projectId);
        const isLocked = readOnlyProjectIds.includes(projectId) || (mode === 'edit' && isChecked && checked.length === 1);
        const hasLabel = slugLabels.some((label) => label.projectId === projectId);
        const checkboxId = `epic-project-${template.slug}-${projectId}`;
        return (
          <label
            key={projectId}
            htmlFor={checkboxId}
            className={cn('flex h-9 items-center gap-2.5 rounded-md px-2 text-sm', isLocked ? 'opacity-55' : 'hover:bg-accent cursor-pointer')}
          >
            <Checkbox id={checkboxId} checked={isChecked} disabled={isLocked} onCheckedChange={() => toggle(projectId)} />
            {project && <EntityAvatar type="project" id={project.id} name={project.name} url={project.thumbnailUrl} className="size-5" />}
            <span className="min-w-0 grow truncate">{project?.name}</span>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{hasLabel ? (usage[projectId] ?? '') : t('c:new_label')}</span>
          </label>
        );
      })}
      {mode === 'make' && (
        <div className="mt-1 flex gap-2 border-t px-1 pt-2 pb-1">
          <Button
            size="sm"
            disabled={!picked.length}
            onClick={() => {
              setEpicProjects(template, slugLabels, picked);
              close();
            }}
          >
            {t('c:make_epic')}
          </Button>
          <Button size="sm" variant="ghost" onClick={close}>
            {t('c:cancel')}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Opens the project picker under `trigger`: to make a tag used in several projects an epic, or to change an epic's projects. */
export const openEpicProjectsPicker = (trigger: HTMLElement, triggerId: string, props: EpicProjectsPickerProps) => {
  dropdowner.getState().create(<EpicProjectsPicker {...props} />, {
    id: `epic-projects-${props.template.slug}`,
    triggerId,
    triggerRef: { current: trigger },
    align: 'start',
    kind: 'panel',
    lead: props.template.name,
  });
};

interface EpicProjectLineProps {
  row: LabelRow;
  isLocked: boolean;
  /** On a workspace: the epic's projects as one button that opens the project picker. */
  scopeProjectIds?: string[];
}

/** Under an open epic's bar: its projects, which a press edits as the task card's label pills do, and Close as epic at the other end. */
export function EpicProjectLine({ row, isLocked, scopeProjectIds }: EpicProjectLineProps) {
  const { t } = useTranslation();
  const { closeEpic } = useEpicMode(row);
  const projects = row.projectIds.map((projectId) => findProjectByIdOrSlug(projectId, row.tenantId)).filter((project) => !!project);
  const epicIn = t('c:epic_in', { projects: projects.map(({ name }) => name).join(', ') });
  const showsProjects = !!scopeProjectIds && scopeProjectIds.length > 1;

  const avatars = projects.map((project) => (
    <EntityAvatar key={project.id} type="project" id={project.id} name={project.name} url={project.thumbnailUrl} className="size-5" />
  ));

  return (
    <div className="flex min-h-8 items-center gap-1">
      {showsProjects && (
        <>
          <span className="text-muted-foreground mr-0.5 text-sm">{t('c:in')}</span>
          {isLocked ? (
            <span className="flex gap-1 px-1.5">{avatars}</span>
          ) : (
            <TooltipButton toolTipContent={epicIn} side="bottom" sideOffset={5}>
              <Button
                variant="ghost"
                size="xs"
                aria-label={epicIn}
                onClick={({ currentTarget }) =>
                  openEpicProjectsPicker(currentTarget, `epic-projects-btn-${row.groupKey}`, {
                    template: row,
                    mode: 'edit',
                    scopeProjectIds,
                    usage: row.projectUsage,
                  })
                }
                className="data-dropdowner-active:bg-muted h-8 gap-1 px-1.5"
              >
                {avatars}
              </Button>
            </TooltipButton>
          )}
        </>
      )}
      {!isLocked && (
        <Button
          variant="ghost"
          size="xs"
          className="text-muted-foreground ml-auto h-8 font-normal"
          onClick={() => {
            labelTileStore.getState().collapse(row.groupKey);
            closeEpic(row);
          }}
        >
          <CircleCheckIcon className="size-3.5" />
          <span>{t('c:close_as_epic')}</span>
        </Button>
      )}
    </div>
  );
}
