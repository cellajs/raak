import type { Label } from 'sdk';

/** Stable id for the always-present labels board panel. Also a persisted board-layout /
 *  collapse-state key, so this string value must not change. */
export const LABELS_PANEL_ID = 'labels';

/** Where a labels view is scoped: one project or a whole workspace. */
export type LabelsScope = 'project' | 'workspace';

/** Scope contract shared by the labels panel, list, tiles and actions. */
export interface LabelsScopeProps {
  entity: LabelsScope;
  entityId: string;
}

/** How the board panel (defaults) or the mobile drawer hosts the labels list. */
export interface LabelsHostProps {
  windowScroll?: boolean;
  /** Off in the drawer: its modal overlay covers the floating selection bar. */
  selectable?: boolean;
  /** One tile open at a time, for the narrow drawer. */
  singleExpand?: boolean;
  onFilterToggle?: () => void;
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
