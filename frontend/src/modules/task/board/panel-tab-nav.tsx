import { type PageTab, PageTabNav } from '~/modules/common/page/tab-nav';
import { useProjectPageTab } from '~/modules/task/board/board-hooks';
import { projectPageGroups } from '~/modules/task/helpers/board-helpers';

const panelTabs = (path: PageTab['path']) =>
  projectPageGroups.map(
    ({ group }, index): PageTab => ({
      id: group,
      label: `c:${group}`,
      path,
      // To do takes no param, so a plain project link opens on it. Exact: a partial match on that search would hold on every tab.
      search: (prev) => ({ ...prev, panelTab: index === 0 ? undefined : group }),
      activeOptions: { exact: index === 0, includeSearch: true },
    }),
  );
const memberTabs = panelTabs('/$tenantId/$organizationSlug/project/$slug');
const publicTabs = panelTabs('/$tenantId/$organizationSlug/public/project/$slug');

/** Tabs of a phone's project page, one per panel, also drawn by its skeleton so the bar does not shift when the board loads. A search spans every status, so it hides them. */
export function PanelTabNav({ publicView }: { publicView?: boolean }) {
  const tab = useProjectPageTab();
  if (!tab) return null;

  return <PageTabNav fallbackToFirst={tab.group === 'to_do'} tabs={publicView ? publicTabs : memberTabs} className="max-sm:border-t" />;
}
