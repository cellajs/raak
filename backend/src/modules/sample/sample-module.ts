import { defineBackendModule } from '#/lib/module';
import { sampleHandlers } from '#/modules/sample/sample-handlers';

defineBackendModule({
  name: 'samples',
  owner: 'app',
  scope: ['frontend', 'backend'],
  routes: [{ path: '/', app: sampleHandlers, phase: 'absolute' }],
  description: `Endpoints for the sample: two projects with tasks by a sample team, which an organization adds to try the
    product before its own work is in. The sample team are accounts nobody signs in to, shared by every organization
    with the sample. Removing the sample deletes its projects and takes the sample team out of the organization.`,
});
