import type { Label } from 'sdk';

/** Where a labels view is scoped: one project or a whole workspace. */
export type LabelsScope = 'project' | 'workspace';

/** Scope contract shared by the labels panel, table, page and actions. */
export interface LabelsScopeProps {
  entity: LabelsScope;
  entityId: string;
}

/** A visible labels row: a concrete label plus its cross-project name-group aggregates. */
export type LabelRow = Label & { siblingIds: string[]; projectIds: string[] };
