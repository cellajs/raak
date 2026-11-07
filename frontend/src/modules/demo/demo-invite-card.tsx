import { UsersIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GetDemoInviteResponse } from 'sdk';
import { appConfig } from 'shared';
import { ApiError } from '~/lib/api';
import { isDemoAddress } from '~/modules/demo/demo-account';
import { Alert, AlertDescription } from '~/modules/ui/alert';
import { Button } from '~/modules/ui/button';
import { Input } from '~/modules/ui/input';
import { Label } from '~/modules/ui/label';
import { dateShort } from '~/utils/date-short';

const refusals = ['demo_ended', 'demo_full'] as const;
export type DemoRefusal = (typeof refusals)[number];

export const refusalOf = (error: unknown): DemoRefusal | undefined =>
  error instanceof ApiError ? refusals.find((refusal) => refusal === error.type) : undefined;

interface DemoInviteCardProps {
  invite?: GetDemoInviteResponse;
  refusal?: DemoRefusal;
  /** The account this browser is signed in to, which joining leaves. */
  account?: { email: string };
  joining: boolean;
  onJoin: (firstName: string) => void;
  /** Drops the link, for a demo of the visitor's own. */
  onOwn: () => void;
}

/**
 * The card of a link into someone's demo: who asks, and a first name to join under. A full or ended demo says
 * so and offers one of the visitor's own.
 */
export function DemoInviteCard({ invite, refusal, account, joining, onJoin, onOwn }: DemoInviteCardProps) {
  const { t, i18n } = useTranslation(['c', 'appError']);
  const [firstName, setFirstName] = useState('');

  if (refusal) {
    return (
      <>
        <h2 className="text-lg font-semibold">{t(`appError:${refusal}`)}</h2>
        <p className="text-[0.9375rem] leading-6">{t(`appError:${refusal}.text`)}</p>
        <Button onClick={onOwn}>{t('c:demo_join.own')}</Button>
      </>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const name = firstName.trim();
    if (name) onJoin(name);
  };

  const names = invite?.people.length ? new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(invite.people) : undefined;
  const date = dateShort(invite?.expiresAt) ?? '';
  const leaves = account && (isDemoAddress(account.email) ? t('c:demo_join.leaves_demo') : t('c:demo_join.signs_out', { email: account.email }));

  return (
    <>
      <h2 className="flex items-center gap-2.5 text-lg font-semibold">
        <UsersIcon className="size-5" />
        {t('c:demo_join', { appName: appConfig.name })}
      </h2>
      <p className="text-[0.9375rem] leading-6">{names ? t('c:demo_join.text', { names, date }) : t('c:demo_join.text_nameless', { date })}</p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="demo-join-name">{t('c:demo_share.name')}</Label>
          <div className="flex gap-2">
            <Input id="demo-join-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" required />
            <Button type="submit" loading={joining}>
              {t('c:join')}
            </Button>
          </div>
          <span className="text-muted-foreground text-xs">{t('c:demo_join.name_hint')}</span>
        </div>
        {leaves && (
          <Alert variant="info">
            <AlertDescription>{leaves}</AlertDescription>
          </Alert>
        )}
      </form>
    </>
  );
}
