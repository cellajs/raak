// App barrel seam (pinned; apps own it): re-exported from `shared/index.ts`, so app-owned config
// under `shared/config/*` (which has no subpath export) reaches consumers through the `shared`
// import without editing the synced barrel. raak exports its label vocabulary here.
export type { LabelColorToken, LabelMode, PrimaryLabelDefinition } from './config/labels-config.ts';
export { labelColorTokens, labelModes, labelSlug, primaryLabelLimits } from './config/labels-config.ts';
