import type { z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { appConfig } from 'shared';
import type { Env, UserContext } from '#/core/context';
import { AppError } from '#/core/error';
import { baseDb } from '#/db/db';
import { updateStamps } from '#/db/utils/stamps';
import { mailer } from '#/lib/mailer';
import { dispatchMutation } from '#/lib/mutation-bus';
import { invalidateCache } from '#/middlewares/guard/invalidate-cache';
import { setUserSession } from '#/modules/auth/sessions/operations/create-session';
import { findSession } from '#/modules/auth/sessions/operations/resolve-session';
import { invokeToken, issueToken } from '#/modules/auth/tokens/token-lifecycle';
import { tokenLinkUrl } from '#/modules/auth/tokens/token-policies';
import { dispatchDeferredInvites } from '#/modules/memberships/operations/deferred-invites';
import { withOrganizationDefaults } from '#/modules/organization/helpers/select';
import { memberContext } from '#/modules/sandbox/operations/member-context';
import { sandboxAnswer } from '#/modules/sandbox/operations/sandbox-place';
import type { SandboxModel } from '#/modules/sandbox/sandbox-db';
import {
  findSandboxByUser,
  findSandboxOrganization,
  markSandboxKept,
  publishSandboxOrganization,
  renameSandboxOrganization,
} from '#/modules/sandbox/sandbox-queries';
import type { sandboxKeepBodySchema } from '#/modules/sandbox/sandbox-schema';
import { addProvenEmail } from '#/modules/user/operations/email-proof';
import { findEmail, findUserById, updateUser } from '#/modules/user/user-queries';
import { log } from '#/utils/logger';
import { accountExistsEmail } from '../../../../emails';
import { sandboxKeepEmail } from '../../../../emails/templates/sandbox-keep';

const dbCtx = { var: { db: baseDb } };

/**
 * Asks to keep the caller's sandbox: takes the typed name and organization name now, and mails a keep link to the
 * address. An address that has an account gets the account-exists mail in its place; the answer is the same either
 * way, so nobody learns here which addresses have an account.
 * @throws AppError 404 when the caller's account is no sandbox.
 */
export async function requestSandboxKeepOp(ctx: UserContext, body: z.infer<typeof sandboxKeepBodySchema>) {
  const { user } = ctx.var;
  const sandbox = await findSandboxByUser(ctx, { userId: user.id });
  if (sandbox?.status !== 'claimed') throw new AppError(404, 'not_found', 'warn', { entityType: 'user' });

  const email = body.email.toLowerCase().trim();
  const name = [body.firstName, body.lastName].filter(Boolean).join(' ');
  await updateUser(ctx, { id: user.id, values: { firstName: body.firstName, lastName: body.lastName, name, ...updateStamps(user.id) } });
  if (body.organizationName) await renameSandboxOrganization(ctx, { id: sandbox.organizationId, name: body.organizationName, by: user.id });

  const recipients = [{ email, lng: user.language }];
  if (await findEmail(ctx, { email })) {
    mailer.sendEmails(accountExistsEmail, { name: '' }, recipients).catch((err) => log.error('Failed to send account-exists email', { err }));
    return;
  }

  const { rawToken } = await issueToken(dbCtx, { type: 'sandbox-keep', userId: user.id, email, createdBy: user.id });
  const keepUrl = tokenLinkUrl('sandbox-keep', rawToken);
  mailer.sendEmails(sandboxKeepEmail, { keepUrl, name }, recipients).catch((err) => log.error('Failed to send sandbox keep email', { err }));
  if (appConfig.mode === 'development') console.info(`[sandbox-keep] ${email} ${keepUrl}`);
  log.info('Sandbox keep link sent', { sandboxId: sandbox.id });
}

/**
 * Makes a sandbox the account of the address its keep link proved: the address joins the account, the organization is
 * published and sends the invitations it held, and the sandbox no longer expires.
 * @throws AppError 409 when another account took the address since the link went out.
 */
async function keepSandbox(sandbox: SandboxModel, email: string) {
  await addProvenEmail(dbCtx, { userId: sandbox.userId, email, via: 'magic' });
  const user = await updateUser(dbCtx, { id: sandbox.userId, values: { email, ...updateStamps(sandbox.userId) } });
  const organization = await findSandboxOrganization(dbCtx, { id: sandbox.organizationId });
  if (!user || !organization) throw new AppError(404, 'sandbox_gone', 'warn', { meta: { sandboxId: sandbox.id } });

  const published = await publishSandboxOrganization(dbCtx, { id: organization.id, by: user.id });
  if (published) {
    await dispatchMutation(await memberContext(user, published), 'organization.updated', {
      before: [withOrganizationDefaults(organization)],
      after: [withOrganizationDefaults(published)],
    });
  }
  await dispatchDeferredInvites(dbCtx, { channelIds: [organization.id], organization: published ?? organization });
  await markSandboxKept(dbCtx, { id: sandbox.id });

  invalidateCache.org(organization.tenantId, organization.id);
  invalidateCache.user(user.id);
  log.info('Sandbox kept', { sandboxId: sandbox.id, organizationId: organization.id });
}

/**
 * Opens a keep link: keeps the sandbox, signs this browser in to it when it is not already, and opens its board. A
 * kept sandbox opens again from the same link within its single-use window.
 * @throws AppError 404 `sandbox_gone` when the sandbox expired first, and what `invokeToken` throws.
 */
export async function openSandboxKeepLink(ctx: Context<Env>, rawToken: string) {
  const token = await invokeToken(ctx, { type: 'sandbox-keep', rawToken });
  const sandbox = token.userId ? await findSandboxByUser(dbCtx, { userId: token.userId }) : undefined;
  if (!sandbox) throw new AppError(404, 'sandbox_gone', 'warn');

  if (sandbox.status === 'claimed') await keepSandbox(sandbox, token.email);

  const user = await findUserById(dbCtx, { id: sandbox.userId });
  if (!user) throw new AppError(404, 'sandbox_gone', 'warn');
  const session = await findSession(ctx);
  if (session?.user.id !== user.id) await setUserSession(ctx, user, 'magic');

  const { path } = await sandboxAnswer(sandbox);
  return ctx.redirect(`${appConfig.frontendUrl}${path}`, 302);
}
