import { defineBackendModule } from '#/lib/module';
import { demoHandlers } from '#/modules/demo/demo-handlers';
import { expireDemos } from '#/modules/demo/operations/demo-expiry';

defineBackendModule({
  name: 'demos',
  owner: 'app',
  scope: ['frontend', 'backend'],
  routes: [{ path: '/', app: demoHandlers, phase: 'absolute' }],
  jobs: [{ name: 'demo-expiry', cron: '23 * * * *', run: () => expireDemos() }],
  description: `Endpoints for demo boards: a visitor's own copy of the product to try, a provisional account with an
    organization holding the sample, built at the claim. Its link lets up to four colleagues join, each on a demo account
    of their own. A demo board ends after two days with everything and everyone in it; it never becomes an account.`,
});
