import { defineBackendModule } from '#/lib/module';
import { expireSandboxes } from '#/modules/sandbox/operations/sandbox-expiry';
import { sandboxHandlers } from '#/modules/sandbox/sandbox-handlers';

defineBackendModule({
  name: 'sandboxes',
  owner: 'app',
  scope: ['frontend', 'backend'],
  routes: [{ path: '/', app: sandboxHandlers, phase: 'absolute' }],
  jobs: [{ name: 'sandbox-expiry', cron: '23 * * * *', run: () => expireSandboxes() }],
  description: `Endpoints for demo boards, sandboxes in code: a visitor's own copy of the product to try, a provisional account
    with an organization holding the sample, built at the claim. Its link lets up to four colleagues join, each on a sandbox
    account of their own. A sandbox ends after two days with everything and everyone in it; it never becomes an account.`,
});
