import DOMPurify from 'dompurify';
import type { HTMLAttributes } from 'react';
import { useUIStore } from '~/modules/ui/ui-store';
import { cn } from '~/utils/cn';

import '@blocknote/shadcn/style.css';
import '~/modules/common/blocknote/styles.css';

type TaskSummaryHtmlProps = { html: string } & HTMLAttributes<HTMLDivElement>;

/** Renders a task's server-generated summary HTML with BlockNote styling; BlockNoteFullHtml handles BlockNote JSON. */
export function TaskSummaryHtml({ html, className = '', ...rest }: TaskSummaryHtmlProps) {
  const mode = useUIStore.getState().mode;

  return (
    <div className={cn(className, `bn-container bn-dense bn-shadcn bn-default-styles ${mode}`)} data-color-scheme={mode} {...rest}>
      <p
        // biome-ignore lint/security/noDangerouslySetInnerHtml: input is sanitized via DOMPurify before render
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
      />
    </div>
  );
}
