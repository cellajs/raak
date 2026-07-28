import type { Label } from 'sdk';

/** Stable id for the always-present labels board panel. Also a persisted board-layout /
 *  collapse-state key, so this string value must not change. */
export const LABELS_PANEL_ID = 'labels';

/** Sentinel projectSlug for the mobile Labels tab; '~' can never appear in a real slug. */
export const LABELS_TAB_SLUG = '~labels';

/** Where a labels view is scoped: one project or a whole workspace. */
export type LabelsScope = 'project' | 'workspace';

/** Scope contract shared by the labels panel, table, page and actions. */
export interface LabelsScopeProps {
  entity: LabelsScope;
  entityId: string;
}

/**
 * A visible labels row: a concrete label plus its cross-project name-group aggregates.
 * `nameLower`/`keywordsLower` are precomputed at grouping time so highlight-mode search does
 * not re-lowercase every row on each render.
 */
export type LabelRow = Label & {
  siblingIds: string[];
  projectIds: string[];
  nameLower: string;
  keywordsLower: string;
};
