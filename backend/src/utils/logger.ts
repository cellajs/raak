import { appConfig, type Severity } from 'shared';
import { BENCH_TENANT_ID, BENCH_UUID_PREFIX } from 'shared/bench-identity';
import type { LogMeta } from 'shared/pino';
import type { Env } from '#/core/context';
import { baseLog } from '#/lib/pino';

const isProduction = appConfig.mode === 'production';

/** Check if traffic originates from bench/load testing (dev only). */
export const isBenchTraffic = (userId?: string, tenantId?: string) => {
  if (isProduction) return false;
  return tenantId === BENCH_TENANT_ID || userId?.startsWith(BENCH_UUID_PREFIX);
};

/** Narrow context type for logging — accepts full Hono ctx or any object with matching .var shape. */
export type LogContext = {
  var: Partial<Pick<Env['Variables'], 'tenantId' | 'userId' | 'organizationId' | 'requestId'>>;
} | null;

const extractBase = (ctx: LogContext) => {
  if (!ctx?.var) return {};
  const { tenantId, userId, organizationId, requestId } = ctx.var;
  return {
    ...(tenantId && { tenantId }),
    ...(userId && { userId }),
    ...(organizationId && { organizationId }),
    ...(requestId && { requestId }),
  };
};

const logAt =
  (severity: Severity) =>
  (ctx: LogContext, msg: string, meta?: LogMeta): void => {
    // Always log errors; for everything else, suppress bench traffic.
    const isError = severity === 'error' || severity === 'fatal';
    if (!isError && ctx?.var && isBenchTraffic(ctx.var.userId, ctx.var.tenantId)) return;

    baseLog[severity](msg, { ...extractBase(ctx), ...meta });
  };

/** Request-aware log facade: `log.warn(ctx, 'msg', { err, ...meta })` — binds tenant/user/request ids from ctx. */
export const log = {
  trace: logAt('trace'),
  debug: logAt('debug'),
  info: logAt('info'),
  warn: logAt('warn'),
  error: logAt('error'),
  fatal: logAt('fatal'),
};
