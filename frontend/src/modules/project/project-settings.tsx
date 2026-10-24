import { Suspense } from 'react';
import { useChannelSettingsSections } from '~/modules/entities/use-channel-settings-sections';
import type { EnrichedProject } from '~/modules/project/types';

interface ProjectSettingsProps {
  project: EnrichedProject;
}

/** The `project.settings` tools, stacked in the settings sheet. */
export function ProjectSettings({ project }: ProjectSettingsProps) {
  const sections = useChannelSettingsSections(project);

  return (
    <div className="mb-12 flex flex-col gap-8">
      {sections.map((section) => (
        <Suspense key={section.id} fallback={null}>
          {section.render(project)}
        </Suspense>
      ))}
    </div>
  );
}
