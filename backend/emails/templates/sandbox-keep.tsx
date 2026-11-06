import { EmailMessage } from '../components';
import { i18n, plainText } from '../i18n';
import { endingFor, linkExpiresText } from '../shared-texts';
import { defineEmailTemplate, type EmailRecipient } from '../types';

interface SandboxKeepStatic {
  keepUrl: string;
  /** The name typed in the keep dialog; empty greets no one. */
  name: string;
}

const previewStatics: SandboxKeepStatic = { keepUrl: 'https://example.com/keep', name: 'Maya de Wit' };

/** The link that makes a sandbox the account of this address: opening it proves the inbox. */
export const sandboxKeepEmail = defineEmailTemplate<SandboxKeepStatic, EmailRecipient & { email: string }>()({
  translate(lng, { keepUrl, name }) {
    return {
      subject: i18n.t('c:sandbox_keep_mail.subject', { lng, ...plainText }),
      previewText: i18n.t('c:sandbox_keep_mail.preview', { lng, ...plainText }),
      headerHtml: i18n.t('c:sandbox_keep_mail.title', { lng }),
      hiText: name ? i18n.t('backend:email.hi', { lng, name, ...plainText }) : '',
      bodyHtml: i18n.t('c:sandbox_keep_mail.text', { lng }),
      buttonText: i18n.t('c:keep_sandbox', { lng }),
      expiresText: linkExpiresText(lng, 'sandbox-keep'),
      endingHtml: `${endingFor(lng, 'ignore')} ${i18n.t('backend:email.ending.no_forward', { lng })}`,
      supportText: i18n.t('backend:email.support_email', { lng }),
      keepUrl,
    };
  },
  component({ previewText, headerHtml, hiText, bodyHtml, buttonText, expiresText, endingHtml, keepUrl, supportText, frame }) {
    return (
      <EmailMessage
        frame={frame}
        previewText={previewText}
        headerHtml={headerHtml}
        greeting={hiText}
        bodyHtml={bodyHtml}
        action={{ label: buttonText, href: keepUrl }}
        note={expiresText}
        endingHtml={endingHtml}
        supportText={supportText}
      />
    );
  },
  preview: { statics: previewStatics, recipient: {} },
});
