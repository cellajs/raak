import { CheckIcon, CopyIcon, Share2Icon } from 'lucide-react';
import { type FormEvent, type ReactElement, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCopyToClipboard } from '~/hooks/use-copy-to-clipboard';
import { useUpdateSelfMutation } from '~/modules/me/query';
import { Button } from '~/modules/ui/button';
import { Input } from '~/modules/ui/input';
import { Label } from '~/modules/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '~/modules/ui/popover';
import { useUserStore } from '~/modules/user/user-store';
import { dateShort } from '~/utils/date-short';
import { isTouchInteraction } from '~/utils/input-modality';

interface SandboxShareProps {
  shareCode: string;
  expiresAt: string | null;
  /** The button that opens it, as the bar and the about page's pill each style theirs. */
  trigger: ReactElement;
}

/**
 * Try it together: the sandbox's link for a colleague, through a phone's share sheet or copied. A sharer who has not
 * given a first name gives it here, so the colleague sees who is who on the board.
 */
export function SandboxShare({ shareCode, expiresAt, trigger }: SandboxShareProps) {
  const { t } = useTranslation();
  const needsName = useUserStore((state) => !state.user?.firstName);
  const [firstName, setFirstName] = useState('');
  const { mutateAsync: updateSelf } = useUpdateSelfMutation();
  const { copied, copyToClipboard } = useCopyToClipboard();
  const viaShareSheet = typeof navigator.share === 'function' && isTouchInteraction();

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const name = firstName.trim();
    if (needsName && !name) return;

    const url = `${window.location.origin}/try/${shareCode}`;
    const text = t('c:sandbox_share.message');
    // Started alongside, not awaited first: the share sheet and the clipboard need the press itself
    const saving = needsName ? updateSelf({ firstName: name }) : undefined;
    if (viaShareSheet) await navigator.share({ text, url }).catch(() => {});
    else await copyToClipboard(`${text} ${url}`);
    await saving;
  };

  return (
    <Popover>
      <PopoverTrigger render={trigger} />
      <PopoverContent side="top" className="flex w-80 flex-col gap-3">
        <h2 className="font-semibold">{t('c:try_together')}</h2>
        <p className="text-muted-foreground text-sm">{t('c:sandbox_share.text', { date: dateShort(expiresAt) ?? '' })}</p>
        <form onSubmit={send} className="flex flex-col gap-3">
          {needsName && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sandbox-share-name">{t('c:sandbox_share.name')}</Label>
              <Input
                id="sandbox-share-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name"
                required
              />
              <span className="text-muted-foreground text-xs">{t('c:sandbox_share.name_hint')}</span>
            </div>
          )}
          <Button type="submit">
            {viaShareSheet ? <Share2Icon /> : copied ? <CheckIcon /> : <CopyIcon />}
            {viaShareSheet ? t('c:share_link') : copied ? t('c:copied') : t('c:copy_link')}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
