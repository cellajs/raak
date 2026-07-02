import { registerModule } from 'shared/module-registry';

registerModule({
  name: 'projects',
  owner: 'app',
  scope: ['frontend', 'backend'],
  description: `Endpoints for managing projects, which are the primary collaborative contexts containing
    tasks, labels, and attachments. Every project belongs to exactly one organization, which defines its
    access scope and ownership. Projects support multiple members and permission based collaboration.`,
});
