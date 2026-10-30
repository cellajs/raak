import { type MouseEvent, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePanelToggle } from '~/modules/common/board/board-drag';
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
  const togglePanel = usePanelToggle();
  const canExpand = !!togglePanel;
  const stripId = `collapsed-${panelId}`;

  useEffect(() => {
    if (!canExpand) return;
    // Collapsed from its handle, the panel keeps the board's place: the current card went with its list. A split project's
    // handle went too, so focus is on the body until the new handle takes it.
    const { currentItemId } = boardFocusStore.getState();
    const panel = document.getElementById(stripId)?.closest('[data-panel]');
    const hadFocus = document.activeElement === document.body || panel?.contains(document.activeElement);
    if (currentItemId && !findItemPanelId(currentItemId) && hadFocus) setCurrentItem(stripId);

    return registerPanelNav(panelId, { items: () => [{ id: stripId }], scrollTo: () => {}, firstInView: () => stripId });
  }, [panelId, canExpand]);

  const handleExpand = (event: MouseEvent<HTMLButtonElement>) => {
    togglePanel?.(panelId);
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
