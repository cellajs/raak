import type { LucideProps } from 'lucide-react';
import { createElement, useSyncExternalStore } from 'react';
import { appConfig } from 'shared';
import { cn } from '~/utils/cn';

type IconNode = [tag: string, attrs: Record<string, string>][];

let iconNodes: Record<string, IconNode> | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

// Lives in json/, outside src/modules where the chunk groups would claim it, so it loads as a lazy chunk of its own
const loadIconNodes = () => {
  loading ??= import('#json/lucide-icon-nodes.json').then(
    ({ default: nodes }) => {
      iconNodes = nodes as unknown as Record<string, IconNode>;
      for (const notify of listeners) notify();
    },
    () => {
      loading = null;
    },
  );
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  loadIconNodes();
  return () => listeners.delete(listener);
};

const getSnapshot = () => iconNodes;

export interface NamedIconProps extends Omit<LucideProps, 'size' | 'ref'> {
  /** Lucide icon name in kebab-case (e.g. 'star', 'bug'), as stored on entities. */
  name: string;
}

/** Renders a lucide icon by name, for user-selected icons stored in the database; code-chosen icons import from lucide-react. */
export function NamedIcon({ name, className, strokeWidth, ...props }: NamedIconProps) {
  const nodes = useSyncExternalStore(subscribe, getSnapshot);

  // Paths are drawn inline: Chrome parses an external `<use>` sprite's whole file again once no mounted icon references it, which stalls a scrolling list.
  // The `lucide` class opts into the global icon defaults (rem-based size); stroke styling is set here because LucideProvider context does not reach these icons.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? appConfig.theme.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={name}
      className={cn('lucide', className)}
      {...props}
    >
      {nodes?.[name]?.map(([tag, attrs], index) => createElement(tag, { key: index, ...attrs }))}
    </svg>
  );
}
