import { defineBackendModule } from '#/lib/module';
import { expireSandboxes, refillSandboxPool } from '#/modules/sandbox/operations/sandbox-pool';
import { sandboxHandlers } from '#/modules/sandbox/sandbox-handlers';

defineBackendModule({
  name: 'sandboxes',
  owner: 'app',
  scope: ['frontend', 'backend'],
  routes: [{ path: '/', app: sandboxHandlers, phase: 'absolute' }],
  jobs: [
    { name: 'sandbox-pool-refill', cron: '* * * * *', run: () => refillSandboxPool() },
    { name: 'sandbox-expiry', cron: '23 * * * *', run: () => expireSandboxes() },
  ],
  description: `Endpoints for sandboxes: a visitor's own copy of the product to try, a provisional account with an
    organization holding the sample, kept in a pool so claiming one is instant. Its link lets up to four colleagues join, each
    on a sandbox account of their own. A sandbox ends after a week with everything and everyone in it; it never becomes an account.`,
});
