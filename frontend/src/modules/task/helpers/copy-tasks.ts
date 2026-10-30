import i18n from 'i18next';
import { appConfig } from 'shared';
import { titleFromDocument } from 'shared/blocknote';
import { announce } from '~/modules/common/announce';
import type { customSchema } from '~/modules/common/blocknote/blocknote-schema';
import { getHeadlessEditor, getParsedContent } from '~/modules/common/blocknote/helpers/blocknote-helpers';
import { toaster } from '~/modules/common/toaster/toaster';
import type { EnrichedProject } from '~/modules/project/types';
import { showStartCheck } from '~/modules/task/card/task-start-check';
import { statusOptionsByValue, TaskStatus } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';
import { findInCache } from '~/query/basic/find-in-list-cache';

const taskToBlocks = (task: Task): (typeof customSchema.PartialBlock)[] => {
  const blocks = getParsedContent(task.description ?? undefined) ?? [];
  const title = titleFromDocument(task.description);
  const meta = [
    task.primaryLabel?.name,
    i18n.t(`c:${statusOptionsByValue[task.status].status}`),
    findInCache<EnrichedProject>('project', task.projectId)?.name,
    `${appConfig.backendUrl}/t/${task.id}`,
  ];

  return [
    { type: 'heading', props: { level: 2 }, content: title || task.name },
    { type: 'paragraph', content: meta.filter(Boolean).join(' · ') },
    // An untitled task opens with a block that has no text (an image, say), so it stays in the body
    ...(title ? blocks.slice(1) : blocks),
  ];
};

const statusControlInView = (taskId: string) =>
  [...document.querySelectorAll(`[data-task-status-control="${taskId}"]`)].find((element) => {
    const { top, bottom, width } = element.getBoundingClientRect();
    return width > 0 && bottom > 0 && top < window.innerHeight;
  });

/** Start hands tasks over, to an agent for one: copy them as started, and say so, since it replaces the clipboard. */
export const copyStartedTasks = async (tasks: Task[]) => {
  const started = tasks.map((task) => ({ ...task, status: TaskStatus.Started }));
  if (!(await copyTasksToClipboard(started))) return;

  const message = i18n.t('c:started_and_copied');
  const control = tasks.map(({ id }) => statusControlInView(id)).find(Boolean);
  // Nothing on screen can show a check: the table has no cards, and a card may be scrolled away
  if (!control) return toaster.success(message);

  announce(control, message);
  for (const { id } of tasks) showStartCheck(id);
};

/** Copies tasks as HTML and Markdown: per task its title as heading, a type · status · project · link line, then the rest of its description. */
export const copyTasksToClipboard = async (tasks: Task[]): Promise<boolean> => {
  try {
    const editor = getHeadlessEditor();
    const blocks = tasks.flatMap(taskToBlocks);
    const html = new Blob([editor.blocksToHTMLLossy(blocks)], { type: 'text/html' });
    const markdown = new Blob([editor.blocksToMarkdownLossy(blocks)], { type: 'text/plain' });
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': html, 'text/plain': markdown })]);
    return true;
  } catch {
    return false;
  }
};
