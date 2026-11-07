import { createXRoutes, errors, json, jsonBody, xRoute } from '#/core/x-routes';
import { publicGuard, userGuard } from '#/middlewares/guard';
import { isNoBot } from '#/middlewares/is-no-bot';
import { rateLimiter } from '#/middlewares/rate-limiter/core';
import { demoClaimSchema, demoInviteSchema, demoJoinBodySchema, demoSchema, demoShareCodeParamSchema } from '#/modules/demo/demo-schema';

/** Demos a network address takes or joins a day; a visitor back at their own demo (200) does not count. */
const demoClaimLimiter = rateLimiter('success', 'demoClaim', ['ip'], {
  limits: { points: 5, duration: 86_400, successStatusCodes: [201] },
  name: 'Demos claimed',
  description: 'Demos each IP address takes or joins a day. Returning to the demo a browser holds does not count.',
});

const demoRoutes = createXRoutes(['demos', 'app'], {
  claimDemo: xRoute({
    method: 'post',
    path: '/demo',
    xGuard: [publicGuard],
    xRateLimiter: [demoClaimLimiter],
    middleware: isNoBot,
    summary: 'Claim a demo',
    description:
      'Gives this browser a demo, a provisional account with an organization holding the sample, and signs it in. ' +
      'A browser signed in to a demo gets that one back. Asked for when a visitor acts on the about page board.',
    responses: {
      200: json('Demo of this browser', demoClaimSchema),
      201: json('Demo claimed\n\nThe session cookie for its account is set.', demoClaimSchema),
      ...errors(409),
    },
  }),
  getDemo: xRoute({
    method: 'get',
    path: '/demo',
    xGuard: [userGuard],
    summary: 'Get demo',
    description: "The signed-in account's demo while it is one: where it opens and when it ends.",
    responses: { 200: json('Demo', demoSchema), ...errors(404) },
  }),
  getDemoInvite: xRoute({
    method: 'get',
    path: '/demo/join/{shareCode}',
    xGuard: [publicGuard],
    request: { params: demoShareCodeParamSchema },
    summary: 'Get demo invite',
    description: 'Who is in the demo a share link leads to, when it ends, and whether this browser can join it.',
    responses: { 200: json('Demo invite', demoInviteSchema), ...errors(404) },
  }),
  joinDemo: xRoute({
    method: 'post',
    path: '/demo/join/{shareCode}',
    xGuard: [publicGuard],
    xRateLimiter: [demoClaimLimiter],
    middleware: isNoBot,
    request: { params: demoShareCodeParamSchema, body: jsonBody(demoJoinBodySchema) },
    summary: 'Join a demo',
    description:
      'Lets this browser into the demo of a share link, on a demo account of its own under the given first name, ' +
      'and signs it in. A browser in that demo already gets it back.',
    responses: {
      200: json('Demo of this browser', demoClaimSchema),
      201: json('Demo joined\n\nThe session cookie for the new account is set.', demoClaimSchema),
      ...errors(404, 409),
    },
  }),
});

export { demoRoutes };
