import type { Label } from 'sdk';

/** Persisted as the board layout and collapse key: the value must not change. */
export const LABELS_PANEL_ID = 'labels';

/** Scope contract shared by the labels panel, list, tiles and actions. */
export interface LabelsScopeProps {
  entity: 'project' | 'workspace';
  entityId: string;
}

/** How the board panel (defaults) or the mobile drawer hosts the labels list. */
export interface LabelsHostProps {
  /** The panel grows with its content and the page scrolls; otherwise the list scrolls internally. */
  windowScroll?: boolean;
  /** Off in the drawer: its modal overlay covers the floating selection bar. */
  selectable?: boolean;
  /** One tile open at a time, for the narrow drawer. */
  singleExpand?: boolean;
  onFilterToggle?: () => void;
  /** The board panel hosting the list: its tiles become board items, one Tab stop with arrow-key navigation. */
  navPanelId?: string;
}

/**
 * A visible labels row: a concrete label plus its cross-project name-group aggregates.
 * `projectUsage` splits `usedCount` by project id.
 * `nameFolded`/`keywordsFolded` are precomputed at grouping time so highlight-mode search does
 * not fold every row on each render.
 */
export type LabelRow = Label & {
  usedCount: number;
  projectUsage: Record<string, number>;
  siblingIds: string[];
  projectIds: string[];
  nameFolded: string;
  keywordsFolded: string;
};
