import type { MiddlewareHandler } from 'hono/types';
import { isbot } from 'isbot';
import { errorResponse } from '../lib/errors';

export const isNoBot: MiddlewareHandler = async (ctx, next) => {
  const userAgent = ctx.req.header('user-agent');

  // Prevent crawlers from causing spam
  if (!isbot(userAgent)) await next();
  else errorResponse(ctx, 403, 'maybe_bot', 'warn');
};