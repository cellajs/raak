import { appConfig } from 'shared';
import { baseDb } from '#/db/db';
import { sandboxAddressDomain } from '#/modules/sandbox/sandbox-constants';
import { insertUsers } from '#/modules/user/user-queries';

/**
 * Inserts a sandbox account under a reserved address with no email row, so no mail reaches it and only a sandbox
 * session signs it in. Without a first name it is a guest until it gives one, as it does to share the sandbox.
 */
export const insertSandboxAccount = async ({ id, handle, firstName }: { id: string; handle: string; firstName?: string }) => {
  const [user] = await insertUsers(
    { var: { db: baseDb } },
    {
      users: [
        {
          id,
          name: firstName ?? 'Guest',
          firstName: firstName ?? null,
          slug: `guest-${handle}`,
          email: `${id}@${sandboxAddressDomain}`,
          language: appConfig.defaultLanguage,
          userFlags: { finishedOnboarding: true },
        },
      ],
    },
  );
  return user;
};
