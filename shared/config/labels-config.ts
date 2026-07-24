/**
 * Label mode taxonomy. `secondary` is the classic free-form tag. `primary` rows replace the
 * former task variant: a small per-project set (provisioned from the organization's
 * setupConfig) of which every task references exactly one. `epic` rows group tasks for
 * dedicated UI treatment.
 */
export const labelModes = ['primary', 'secondary', 'epic'] as const;

export type LabelMode = (typeof labelModes)[number];

/**
 * Curated color tokens for primary labels. Tokens (not raw hex) are stored so the client
 * can resolve theme-aware class pairs per token; see the frontend labelPalette map.
 */
export const labelColorTokens = [
  'red',
  'orange',
  'amber',
  'yellow',
  'green',
  'emerald',
  'teal',
  'sky',
  'blue',
  'indigo',
  'violet',
  'pink',
  'slate',
] as const;

export type LabelColorToken = (typeof labelColorTokens)[number];

/** Bounds for an organization's primary label set. */
export const primaryLabelLimits = { min: 1, max: 6 } as const;

/**
 * One entry of an organization's primary label set (setupConfig.primaryLabels). Array order
 * is display and hotkey order; the first entry is the default for new tasks. Slug is the
 * tracking identity that links provisioned per-project rows back to their setupConfig entry.
 */
export interface PrimaryLabelDefinition {
  slug: string;
  name: string;
  color: LabelColorToken;
  icon: string | null;
}

/**
 * Normalize a label name into its slug identity: lowercase, spaces to dashes, stripped of
 * characters outside [a-z0-9-]. Slugs key organization tracking and cross-project matching;
 * name stays free-form for display.
 */
export const labelSlug = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
