import { useSearch } from '@tanstack/react-router';
import i18n from 'i18next';
import { TagIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { sheeter, type TriggerRef } from '~/modules/common/sheeter/use-sheeter';
import { LabelList } from '~/modules/label/label-list';
import type { LabelsScopeProps } from '~/modules/label/types';
import { Button } from '~/modules/ui/button';

const labelsDrawerId = 'labels-drawer';

// A label's filter, highlight or exclude only shows on the board behind the drawer
const closeLabelsDrawer = () => sheeter.getState().remove(labelsDrawerId);

const openLabelsDrawer = ({ entity, entityId }: LabelsScopeProps, triggerRef: TriggerRef) => {
  const { get, create } = sheeter.getState();
  if (get(labelsDrawerId)) return;

  const list = <LabelList entity={entity} entityId={entityId} windowScroll singleExpand onAction={closeLabelsDrawer} />;
  create(list, { id: labelsDrawerId, triggerRef, side: 'right', title: i18n.t('c:label_other').toLowerCase() });
};

function MobileLabelsDrawerButton(props: LabelsScopeProps) {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const labelPageId = useSearch({ strict: false, select: (search) => search.labelPageId });

  // Mirrors the desktop board revealing its labels panel for a label link
  useEffect(() => {
    if (labelPageId) openLabelsDrawer(props, triggerRef);
  }, [labelPageId]);

  // Past the breakpoint the sheeter would turn the drawer into a sheet beside the labels panel
  useEffect(() => () => sheeter.getState().remove(labelsDrawerId, { isCleanup: true }), []);

  return (
    <Button
      ref={triggerRef}
      variant="ghost"
      aria-label={t('c:label_other')}
      className="group-data-[search-focused=true]/boardHeader:hidden"
      onClick={() => openLabelsDrawer(props, triggerRef)}
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
