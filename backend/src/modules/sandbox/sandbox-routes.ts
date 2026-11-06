import { createXRoutes, errors, json, xRoute } from '#/core/x-routes';
import { publicGuard, userGuard } from '#/middlewares/guard';
import { isNoBot } from '#/middlewares/is-no-bot';
import { rateLimiter } from '#/middlewares/rate-limiter/core';
import { sandboxClaimSchema, sandboxSchema } from '#/modules/sandbox/sandbox-schema';

/** New sandboxes a network address takes a day; a visitor back at their own sandbox (200) does not count. */
const sandboxClaimLimiter = rateLimiter('success', 'sandboxClaim', ['ip'], {
  limits: { points: 5, duration: 86_400, successStatusCodes: [201] },
  name: 'Sandboxes claimed',
  description: 'New sandboxes for each IP address a day. Returning to the sandbox a browser holds does not count.',
});

const sandboxRoutes = createXRoutes(['sandboxes', 'app'], {
  claimSandbox: xRoute({
    method: 'post',
    path: '/sandbox',
    xGuard: [publicGuard],
    xRateLimiter: [sandboxClaimLimiter],
    middleware: isNoBot,
    summary: 'Claim a sandbox',
    description:
      'Gives this browser a sandbox, a provisional account with an organization holding the sample, and signs it in. ' +
      'A browser signed in to a sandbox gets that one back. Asked for when a visitor acts on the about page board.',
    responses: {
      200: json('Sandbox of this browser', sandboxClaimSchema),
      201: json('Sandbox claimed\n\nThe session cookie for its account is set.', sandboxClaimSchema),
      ...errors(409),
    },
  }),
  getSandbox: xRoute({
    method: 'get',
    path: '/sandbox',
    xGuard: [userGuard],
    summary: 'Get sandbox',
    description: "The signed-in account's sandbox while it is one: where it opens and when it ends.",
    responses: { 200: json('Sandbox', sandboxSchema), ...errors(404) },
  }),
});

export { sandboxRoutes };
