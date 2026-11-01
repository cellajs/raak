import { type MouseEvent, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePanelDragHandle } from '~/modules/common/board/board-drag';
import { CollapsedPanelView, type CollapsedSection } from '~/modules/common/board/board-panel';
import { boardFocusStore } from '~/modules/task/board/board-focus-store';
import { focusPanelOnceListed, setCurrentItem } from '~/modules/task/helpers/focus-item';
import { findItemPanelId, registerPanelNav } from '~/modules/task/helpers/panel-nav-registry';

interface CollapsedPanelStripProps {
  panelId: string;
  name: string;
  mainCount?: number;
  sections?: CollapsedSection[];
  className?: string;
}

/** A collapsed panel's strip: the one item the board's arrow keys reach in it, expanded by Enter or a click. */
export function CollapsedPanelStrip({ panelId, name, ...viewProps }: CollapsedPanelStripProps) {
  const { t } = useTranslation();
  const panelDrag = usePanelDragHandle();
  const canExpand = !!panelDrag;
  const stripId = `collapsed-${panelId}`;

  useEffect(() => {
    if (!canExpand) return;
    // Collapsed from its handle, the panel keeps the board's place: the current card went with its list
    const { currentItemId } = boardFocusStore.getState();
    const panel = document.getElementById(stripId)?.closest('[data-panel]');
    if (currentItemId && !findItemPanelId(currentItemId) && panel?.contains(document.activeElement)) setCurrentItem(stripId);

    return registerPanelNav(panelId, { items: () => [{ id: stripId }], scrollTo: () => {}, firstInView: () => stripId });
  }, [panelId, canExpand]);

  const handleExpand = (event: MouseEvent<HTMLButtonElement>) => {
    panelDrag?.onToggleCollapsed();
    // A key press goes on into the list; a click leaves focus to the pointer
    if (event.detail === 0) focusPanelOnceListed(panelId, stripId);
  };

  return (
    <CollapsedPanelView
      {...viewProps}
      expand={canExpand ? { id: stripId, label: t('c:expand_panel', { name }), onExpand: handleExpand } : undefined}
    />
  );
}
