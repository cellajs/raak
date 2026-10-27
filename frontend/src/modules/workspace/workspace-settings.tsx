import i18n from 'i18next';
import { type RefObject, Suspense } from 'react';
import type { Workspace } from 'sdk';
import { NamedText } from '~/modules/common/named-text';
import { sheeter } from '~/modules/common/sheeter/use-sheeter';
import { UnsavedBadge } from '~/modules/common/unsaved-badge';
import { useChannelSettingsSections } from '~/modules/entities/use-channel-settings-sections';

export function openWorkspaceSettingsSheet(workspace: Workspace, triggerRef: RefObject<HTMLButtonElement | null>) {
  sheeter.getState().create(
    <div className="container">
      <WorkspaceSettings workspace={workspace} />
    </div>,
    {
      id: 'update-workspace',
      triggerRef,
      side: 'right',
      title: i18n.t('c:resource_settings', { resource: i18n.t('c:workspace') }),
      titleContent: <UnsavedBadge title={i18n.t('c:resource_settings', { resource: i18n.t('c:workspace') })} />,
      description: <NamedText i18nKey="c:workspace_settings.text" name={workspace.name} />,
    },
  );
}

interface WorkspaceSettingsProps {
  workspace: Workspace;
}

/** The `workspace.settings` tools, stacked in the settings sheet. */
function WorkspaceSettings({ workspace }: WorkspaceSettingsProps) {
  const sections = useChannelSettingsSections(workspace);

  return (
    <div className="mb-12 flex flex-col gap-8">
      {sections.map((section) => (
        <Suspense key={section.id} fallback={null}>
          {section.render(workspace)}
        </Suspense>
      ))}
    </div>
  );
}
