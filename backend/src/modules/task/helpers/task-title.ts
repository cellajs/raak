import { titleFromDocument } from 'shared/blocknote';
import { htmlToExcerpt } from '#/modules/notification/helpers/render-digest-html';
import { maxLength } from '#/schemas';

/** A task's title is its summary block: `name` is empty for a task made in the app, and older rows hold it as HTML. */
export const taskTitle = ({ summary, name }: { summary: string; name: string }) => titleFromDocument(summary) || htmlToExcerpt(name, maxLength.field);
