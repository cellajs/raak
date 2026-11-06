import { useState } from 'react';
import type { TKey } from '~/lib/i18n-locales';
import { ActiveTabMarker, type TabIndicator, useTabIndicator } from '~/modules/common/page/tab-indicator';
import { TabNavLabel, TabNavShell, tabNavItemClass } from '~/modules/common/page/tab-nav-shell';
import { demoProjects } from '~/modules/marketing/about/demo/fixtures';

const noScroll = () => {};

/** The real project tabs of a phone without their scroll: a tab moved by the script must never move the page under the visitor. */
export function DemoTabs({ activeId }: { activeId: string }) {
  const baseIndicator = useTabIndicator();
  const [indicator] = useState<TabIndicator>(() => ({ ...baseIndicator, reveal: noScroll }));

  return (
    <TabNavShell indicator={indicator}>
      {demoProjects.map(({ id, name }) => (
        <button
          key={id}
          data-tab={id}
          type="button"
          className={tabNavItemClass}
          data-active={id === activeId || undefined}
          aria-current={id === activeId || undefined}
        >
          {/* Project names are display strings, not keys; the label's t() falls back to the raw name */}
          <TabNavLabel label={name as TKey} />
          {id === activeId && <ActiveTabMarker indicator={indicator} />}
        </button>
      ))}
    </TabNavShell>
  );
}
