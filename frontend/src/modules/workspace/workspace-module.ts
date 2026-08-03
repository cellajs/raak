import type { Workspace } from 'sdk';
import { defineFrontendModule } from '~/lib/module';
import type { ChannelEnrichment } from '~/modules/entities/types';

declare module '~/lib/placements' {
  interface ChannelEntityByType {
    workspace: Workspace & ChannelEnrichment;
  }
}

defineFrontendModule({
  name: 'workspaces',
  owner: 'app',
  scope: ['frontend'],
  description: 'UI for managing workspaces, personal containers that bundle related projects for a single user.',
});
