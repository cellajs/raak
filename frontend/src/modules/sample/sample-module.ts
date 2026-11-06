import { defineFrontendModule } from '~/lib/module';

defineFrontendModule({
  name: 'samples',
  owner: 'app',
  scope: ['frontend', 'backend'],
  description: 'The sample projects an organization adds to try the product: the add button, the Sample mark and their removal.',
});
