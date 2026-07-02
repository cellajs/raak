import { registerModule } from 'shared/module-registry';

registerModule({
  name: 'projects',
  owner: 'app',
  scope: ['frontend'],
  description:
    'UI for managing projects, the primary collaborative contexts containing tasks, labels, and attachments.',
});
