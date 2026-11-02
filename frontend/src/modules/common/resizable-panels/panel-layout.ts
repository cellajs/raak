// Pure width logic: no DOM, so every rule here runs in a plain unit test. Rules & examples → resizable-panels.md

export interface PanelConfig {
  id: string;
  minWidth: number;
  collapsedWidth: number;
  collapsible: boolean;
}

export interface HintData {
  panelId: string;
  /** The panel's side that faces the dragged separator */
  side: 'left' | 'right';
  /** `cover`: the neighbour of an expanding panel, which the curtain covers by the width that panel takes */
  mode: 'collapse' | 'expand' | 'cover';
  /** 0 to 1 across the hint's zone */
  progress: number;
  /** Curtain width at full progress in px; 0 draws none */
  reach: number;
}

export interface LayoutResult {
  widths: Record<string, number>;
  hints: HintData[];
}

export interface DragState {
  separatorIndex: number;
  startX: number;
  /** The mode (G6), fixed at drag start; false is overflow */
  autoFill: boolean;
  initialWidths: Record<string, number>;
  collapsedAtStart: Set<string>;
}

// G2: past this width a shrinking victim collapses; before it, it holds minWidth
const collapseSnapPoint = (panel: PanelConfig) => (panel.collapsedWidth + panel.minWidth) / 2.2;

function collapseProgress(panel: PanelConfig, rawWidth: number): number {
  const snapPoint = collapseSnapPoint(panel);
  if (rawWidth >= panel.minWidth || rawWidth <= snapPoint) return 0;
  return (panel.minWidth - rawWidth) / (panel.minWidth - snapPoint);
}

// Idempotent and DOM-free: dragging backward re-evaluates from initialWidths and reverses.
export function resolveLayout(panels: PanelConfig[], drag: DragState, dx: number): LayoutResult {
  const { separatorIndex, initialWidths, collapsedAtStart, autoFill } = drag;
  const widths = { ...initialWidths };
  const hints: HintData[] = [];

  if (dx === 0) return { widths, hints };

  const draggingLeft = dx < 0;
  const absDx = Math.abs(dx);

  // G1: the panel the separator moves away from grows
  const growerIndex = draggingLeft ? separatorIndex + 1 : separatorIndex;
  const grower: PanelConfig | undefined = panels[growerIndex];
  const isExpandingFromCollapsed = !!grower?.collapsible && collapsedAtStart.has(grower.id);
  const expandCost = grower && isExpandingFromCollapsed ? grower.minWidth - grower.collapsedWidth : 0;

  // Expand gate (G3)
  if (isExpandingFromCollapsed && absDx < expandCost) {
    const progress = absDx / expandCost;
    hints.push({ panelId: grower.id, side: draggingLeft ? 'left' : 'right', mode: 'expand', progress, reach: 0 });
    const neighbour = panels[draggingLeft ? separatorIndex : separatorIndex + 1];
    if (neighbour) hints.push({ panelId: neighbour.id, side: draggingLeft ? 'right' : 'left', mode: 'cover', progress, reach: expandCost });
    return { widths, hints };
  }

  // Victim list (G1, G9)
  const victimIndices: number[] = [];
  if (draggingLeft) {
    for (let i = separatorIndex; i >= 0; i--) victimIndices.push(i);
  } else {
    for (let i = separatorIndex + 1; i < panels.length; i++) victimIndices.push(i);
  }

  let remaining = absDx;
  // Overflow mode funds the expand from trailing gap (O2); autoFill makes victims fund it.
  if (expandCost > 0 && !autoFill) {
    remaining -= expandCost;
  }

  let totalFreed = 0;
  let collapseFreed = 0;

  const directVictimIndex = victimIndices[0];

  const growerInitialWidth = grower ? (initialWidths[grower.id] ?? grower.minWidth) : 0;

  // G9 phase 1: shrink all victims toward minWidth
  for (const victimIndex of victimIndices) {
    const victim = panels[victimIndex];
    if (!victim || remaining <= 0) break;
    if (collapsedAtStart.has(victim.id)) continue;

    const initialWidth = initialWidths[victim.id] ?? victim.minWidth;
    const shrinkRoom = initialWidth - victim.minWidth;
    if (shrinkRoom <= 0) continue;

    const consumed = Math.min(shrinkRoom, remaining);
    widths[victim.id] = initialWidth - consumed;
    remaining -= consumed;
    totalFreed += consumed;
  }

  // G9 phase 2: collapse victims nearest first, only once all are at min
  if (remaining > 0) {
    for (const victimIndex of victimIndices) {
      const victim = panels[victimIndex];
      if (!victim || remaining <= 0) break;
      if (collapsedAtStart.has(victim.id)) continue;
      if (!victim.collapsible) continue;

      // G10: overflow gets a free expand from trailing gap, so the block is autoFill only
      if (autoFill && isExpandingFromCollapsed && victimIndex === directVictimIndex && totalFreed < expandCost) {
        continue;
      }

      const rawWidth = victim.minWidth - remaining;

      // Collapse hint (G4)
      const progress = collapseProgress(victim, rawWidth);
      if (progress > 0) {
        hints.push({
          panelId: victim.id,
          side: draggingLeft ? 'right' : 'left',
          mode: 'collapse',
          progress,
          reach: victim.minWidth - victim.collapsedWidth,
        });
      }

      if (rawWidth >= collapseSnapPoint(victim)) {
        // Layout freezes at minWidth inside the collapse zone
        widths[victim.id] = victim.minWidth;
        break;
      }

      const consumed = victim.minWidth - victim.collapsedWidth;
      widths[victim.id] = victim.collapsedWidth;
      remaining -= consumed;
      collapseFreed += consumed;
    }
  }

  // Let the growing panel absorb freed pixels; final redistribution clamps it to viewport.
  if (grower) {
    let growDelta = totalFreed;

    if (isExpandingFromCollapsed) {
      const totalAvailable = growDelta + collapseFreed;
      const extraGrowth = autoFill ? Math.max(0, totalAvailable - expandCost) : totalAvailable;
      widths[grower.id] = grower.minWidth + extraGrowth;
    } else if (!collapsedAtStart.has(grower.id)) {
      growDelta += collapseFreed;
      widths[grower.id] = growerInitialWidth + growDelta;
    }
  }

  return { widths, hints };
}
