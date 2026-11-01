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
  /** One tile open at a time, for the narrow drawer. */
  singleExpand?: boolean;
  /** The board panel hosting the list: its tiles become board items, one Tab stop with arrow-key navigation. */
  navPanelId?: string;
}

/**
 * A visible labels row: a concrete label plus its cross-project name-group aggregates.
 * `usedCount` counts the tasks not yet accepted, `totalCount` all of them; `projectUsage` splits `usedCount` by project id.
 */
export type LabelRow = Label & {
  usedCount: number;
  totalCount: number;
  projectUsage: Record<string, number>;
  siblingIds: string[];
  projectIds: string[];
};
