import { createXRoutes, errors, json, jsonBody, xRoute } from '#/core/x-routes';
import { publicGuard, userGuard } from '#/middlewares/guard';
import { isNoBot } from '#/middlewares/is-no-bot';
import { rateLimiter } from '#/middlewares/rate-limiter/core';
import {
  sandboxClaimSchema,
  sandboxInviteSchema,
  sandboxJoinBodySchema,
  sandboxSchema,
  sandboxShareCodeParamSchema,
} from '#/modules/sandbox/sandbox-schema';

/** Sandboxes a network address takes or joins a day; a visitor back at their own sandbox (200) does not count. */
const sandboxClaimLimiter = rateLimiter('success', 'sandboxClaim', ['ip'], {
  limits: { points: 5, duration: 86_400, successStatusCodes: [201] },
  name: 'Sandboxes claimed',
  description: 'Sandboxes each IP address takes or joins a day. Returning to the sandbox a browser holds does not count.',
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
  getSandboxInvite: xRoute({
    method: 'get',
    path: '/sandbox/join/{shareCode}',
    xGuard: [publicGuard],
    request: { params: sandboxShareCodeParamSchema },
    summary: 'Get sandbox invite',
    description: 'Who is in the sandbox a share link leads to, when it ends, and whether this browser can join it.',
    responses: { 200: json('Sandbox invite', sandboxInviteSchema), ...errors(404) },
  }),
  joinSandbox: xRoute({
    method: 'post',
    path: '/sandbox/join/{shareCode}',
    xGuard: [publicGuard],
    xRateLimiter: [sandboxClaimLimiter],
    middleware: isNoBot,
    request: { params: sandboxShareCodeParamSchema, body: jsonBody(sandboxJoinBodySchema) },
    summary: 'Join a sandbox',
    description:
      'Lets this browser into the sandbox of a share link, on a sandbox account of its own under the given first name, ' +
      'and signs it in. A browser in that sandbox already gets it back.',
    responses: {
      200: json('Sandbox of this browser', sandboxClaimSchema),
      201: json('Sandbox joined\n\nThe session cookie for the new account is set.', sandboxClaimSchema),
      ...errors(404, 409),
    },
  }),
});

export { sandboxRoutes };
