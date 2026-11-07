import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { UsersIcon } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appConfig } from 'shared';
import { ApiError } from '~/lib/api';
import { AuthHeader } from '~/modules/auth/auth-header';
import { endSession } from '~/modules/auth/end-session';
import { ErrorNotice } from '~/modules/common/error-notice';
import { Spinner } from '~/modules/common/spinner';
import { enterSandbox } from '~/modules/sandbox/first-view';
import { sandboxInviteQueryOptions, sandboxQueryOptions, useSandboxJoinMutation } from '~/modules/sandbox/query';
import { isSandboxAddress } from '~/modules/sandbox/sandbox-account';
import { Alert, AlertDescription } from '~/modules/ui/alert';
import { Button } from '~/modules/ui/button';
import { Input } from '~/modules/ui/input';
import { Label } from '~/modules/ui/label';
import { useUserStore } from '~/modules/user/user-store';
import { queryClient } from '~/query/query-client';
import { dateShort } from '~/utils/date-short';

const refusals = ['sandbox_ended', 'sandbox_full'] as const;
type Refusal = (typeof refusals)[number];

const refusalOf = (error: unknown): Refusal | undefined =>
  error instanceof ApiError ? refusals.find((refusal) => refusal === error.type) : undefined;

/**
 * A sandbox's share link: who asks, and a first name to join under, on a sandbox account of this browser's own. A
 * browser in the sandbox already goes straight to its board; one signed in to another account leaves it to join.
 */
export function JoinSandboxPage({ shareCode }: { shareCode: string }) {
  const { t, i18n } = useTranslation(['c', 'appError']);
  const user = useUserStore((state) => state.user);
  const { data: invite, error, refetch } = useQuery(sandboxInviteQueryOptions(shareCode));
  const { mutateAsync: join, error: joinError } = useSandboxJoinMutation();
  const [firstName, setFirstName] = useState('');
  const [busy, setBusy] = useState(false);
  const leaving = useRef(false);

  const joined = !!invite?.joined;
  useEffect(() => {
    if (!joined || leaving.current) return;
    leaving.current = true;
    queryClient.fetchQuery(sandboxQueryOptions()).then(({ path }) => window.location.assign(path));
  }, [joined]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const name = firstName.trim();
    if (!name) return;
    setBusy(true);
    try {
      if (user) await endSession({ wipe: true });
      const sandbox = await join({ shareCode, firstName: name });
      leaving.current = true;
      await enterSandbox(sandbox);
      window.location.assign(sandbox.path);
    } catch {
      setBusy(false);
      refetch();
    }
  };

  const refusal = refusalOf(error) ?? (invite?.full ? 'sandbox_full' : refusalOf(joinError));
  if (refusal) {
    return (
      <>
        <AuthHeader title={t(`appError:${refusal}`)} description={t(`appError:${refusal}.text`)} />
        <Button size="block" render={<Link to="/about" />}>
          {t('c:sandbox_join.own')}
        </Button>
      </>
    );
  }
  if (error) return <ErrorNotice error={error} boundary="public" />;
  if (!invite || joined) return <Spinner size="lg" />;

  const names = invite.people.length ? new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(invite.people) : undefined;
  const date = dateShort(invite.expiresAt) ?? '';
  const leaves = user && (isSandboxAddress(user.email) ? t('c:sandbox_join.leaves_sandbox') : t('c:sandbox_join.signs_out', { email: user.email }));

  return (
    <>
      <AuthHeader
        image={<UsersIcon className="size-10" strokeWidth={1.5} />}
        title={t('c:sandbox_join', { appName: appConfig.name })}
        description={names ? t('c:sandbox_join.text', { names, date }) : t('c:sandbox_join.text_nameless', { date })}
      />
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sandbox-join-name">{t('c:sandbox_share.name')}</Label>
          <Input id="sandbox-join-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" required />
          <span className="text-muted-foreground text-xs">{t('c:sandbox_join.name_hint')}</span>
        </div>
        {leaves && (
          <Alert variant="info">
            <AlertDescription>{leaves}</AlertDescription>
          </Alert>
        )}
        <Button size="block" type="submit" loading={busy}>
          {t('c:join')}
        </Button>
      </form>
    </>
  );
}
