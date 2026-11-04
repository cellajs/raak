import { onlineManager } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { toastOffline } from '~/modules/common/toaster/toaster';
import { useMemberUpdateMutation } from '~/modules/memberships/query-mutations';
import type { EnrichedProject } from '~/modules/project/types';
import { Alert } from '~/modules/ui/alert';
import { Button } from '~/modules/ui/button';
import { Popover, PopoverContent } from '~/modules/ui/popover';
import { useIsWorkspaceRoute, useWorkspaceContext } from '~/modules/workspace/use-workspace-context';
import { useWorkspaceArrivalStore } from '~/modules/workspace/workspace-arrival-store';
import { findMembership, getCachedMemberships } from '~/query/enrichment/helpers';
import { getRouter } from '~/routes/-router-instance';

interface BalloonProps {
  project: EnrichedProject;
}

function RestoredMessage({ project }: BalloonProps) {
  const { t } = useTranslation();
  const { workspace, organization, tenantId } = useWorkspaceContext();
  const clearArrival = useWorkspaceArrivalStore((state) => state.clearArrival);
  const { mutateAsync: updateMembership, isPending } = useMemberUpdateMutation();

  const undo = async () => {
    if (!onlineManager.isOnline()) return toastOffline();
    const membership = findMembership(getCachedMemberships() ?? [], project.id);
    if (!membership) return;
    try {
      await updateMembership({
        path: { organizationId: organization.id, tenantId, id: membership.id },
        body: { archived: true },
        channelId: project.id,
        channelType: 'project',
      });
      clearArrival();
      // The press came from the project page, and this board no longer shows the project
      getRouter().navigate({
        to: '/$tenantId/$organizationSlug/project/$slug',
        params: { slug: project.slug, organizationSlug: organization.slug, tenantId },
      });
    } catch {
      // The global error handler has toasted it: the balloon stays for another try
    }
  };

  return (
    <div className="col-start-2 flex items-center justify-between gap-3">
      <span className="min-w-0 truncate">{t('c:restored_to_workspace.text', { name: workspace.name })}</span>
      <Button variant="secondary" loading={isPending} onClick={undo}>
        {t('c:undo')}
      </Button>
    </div>
  );
}

function ArrivalPlacement({ project }: BalloonProps) {
  const isMobile = useBreakpointBelow('sm');
  const clearArrival = useWorkspaceArrivalStore((state) => state.clearArrival);
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);

  // A new board applies its saved panel widths after mounting, which leaves the board's own scroll to this panel short
  useEffect(() => {
    if (!anchor) return;
    const observer = new ResizeObserver(() => anchor.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }));
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [anchor]);

  if (isMobile) {
    return (
      // Above the floating nav buttons, which take the corners of the bottom edge
      <Alert variant="info" role="status" className="fixed inset-x-3 bottom-[calc(5.5rem+var(--bottom-inset,0px))] z-110 w-auto shadow-floating">
        <RestoredMessage project={project} />
      </Alert>
    );
  }

  return (
    <>
      <div ref={setAnchor} />
      {/* Above the sticky status bars (z-85), as the drop ring in BoardPanel */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-90 rounded-t-lg ring-2 ring-info ring-inset" />
      {anchor && (
        <Popover open onOpenChange={(open) => !open && clearArrival()}>
          <PopoverContent
            anchor={anchor}
            side="bottom"
            align="start"
            alignOffset={8}
            initialFocus={false}
            className="w-80 border-0 bg-transparent p-0 shadow-none"
          >
            <Alert variant="info" role="status" className="shadow-floating">
              <span aria-hidden className="soft-bg soft-border absolute -top-1.5 left-6 size-2.5 rotate-45 border-t border-l" />
              <RestoredMessage project={project} />
            </Alert>
          </PopoverContent>
        </Popover>
      )}
    </>
  );
}

/** Says "Open in workspace" just restored this project's panel, below its header or on a phone above the bottom edge. */
export function WorkspaceArrivalBalloon({ project }: BalloonProps) {
  const arrived = useWorkspaceArrivalStore((state) => state.projectId === project.id);
  const isWorkspaceRoute = useIsWorkspaceRoute();

  if (!arrived || !isWorkspaceRoute) return null;
  return <ArrivalPlacement project={project} />;
}
