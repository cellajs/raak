import { useSearch } from '@tanstack/react-router';
import i18n from 'i18next';
import { TagIcon } from 'lucide-react';
import { Suspense, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { type TriggerRef, useSheeter } from '~/modules/common/sheeter/use-sheeter';
import { Spinner } from '~/modules/common/spinner';
import { LabelList } from '~/modules/label/label-list';
import type { LabelsScopeProps } from '~/modules/label/types';
import { Button } from '~/modules/ui/button';

const LABELS_DRAWER_ID = 'labels-drawer';

// A filter only shows on the board behind the drawer
const closeLabelsDrawer = () => useSheeter.getState().remove(LABELS_DRAWER_ID);

const openLabelsDrawer = ({ entity, entityId }: LabelsScopeProps, triggerRef: TriggerRef) => {
  if (useSheeter.getState().get(LABELS_DRAWER_ID)) return;

  useSheeter.getState().create(
    <Suspense fallback={<Spinner className="my-4" noDelay />}>
      <LabelList entity={entity} entityId={entityId} windowScroll selectable={false} singleExpand onFilterToggle={closeLabelsDrawer} />
    </Suspense>,
    { id: LABELS_DRAWER_ID, triggerRef, side: 'right', title: i18n.t('c:label_other').toLowerCase() },
  );
};

function MobileLabelsDrawerButton({ entity, entityId }: LabelsScopeProps) {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const labelPageId = useSearch({ strict: false, select: (search) => search.labelPageId });

  // Mirrors the desktop board revealing its labels panel for a label link
  useEffect(() => {
    if (labelPageId) openLabelsDrawer({ entity, entityId }, triggerRef);
  }, [labelPageId]);

  // Past the breakpoint the sheeter would turn the drawer into a sheet beside the labels panel
  useEffect(() => () => useSheeter.getState().remove(LABELS_DRAWER_ID, { isCleanup: true }), []);

  return (
    <Button
      ref={triggerRef}
      variant="outline"
      aria-label={t('c:label_other')}
      className="group-data-[search-focused=true]/boardHeader:hidden"
      onClick={() => openLabelsDrawer({ entity, entityId }, triggerRef)}
    >
      <TagIcon />
    </Button>
  );
}

/** Mobile board header button opening the labels in a drawer; from `sm` up the board has a labels panel. */
export function LabelsDrawerButton(props: LabelsScopeProps) {
  const isMobile = useBreakpointBelow('sm');
  return isMobile ? <MobileLabelsDrawerButton {...props} /> : null;
}
