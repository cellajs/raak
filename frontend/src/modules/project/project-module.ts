import { defineFrontendModule } from '~/lib/module';
import type { EnrichedProject } from '~/modules/project/types';

declare module '~/lib/placements' {
  interface ChannelEntityByType {
    project: EnrichedProject;
  }
}

defineFrontendModule({
  name: 'projects',
  owner: 'app',
  scope: ['frontend'],
  description:
    'UI for managing projects, the primary collaborative contexts containing tasks, labels, and attachments.',
});
