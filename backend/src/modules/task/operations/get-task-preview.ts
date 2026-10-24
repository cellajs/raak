import type { Block } from '@blocknote/core';
import { appConfig } from 'shared';
import { getTextFromBlock } from 'shared/blocknote';
import type { DbContext } from '#/core/context';
import { AppError } from '#/core/error';
import { withActorRef } from '#/modules/actors/actor-refs';
import { findLabelNameById } from '#/modules/label/label-queries';
import { findLiveTaskById, findTaskLinkTarget } from '#/modules/task/task-queries';

/** The unfurl of a task link: page title, type and description, plus the frontend url the page sends the visitor to. */
export const getTaskPreview = async (ctx: DbContext, id: string) => {
  const found = await findLiveTaskById(ctx, { id });
  if (!found) throw new AppError(404, 'not_found', 'warn', { entityType: 'task', willRedirect: true });

  const task = await withActorRef(ctx, found);
  const project = await findTaskLinkTarget(ctx, { projectId: task.projectId });
  if (!project) throw new AppError(404, 'not_found', 'warn', { entityType: 'project', willRedirect: true });

  const blocks = JSON.parse(task.description ?? '[]') as Block[];
  const fullText = blocks.map(getTextFromBlock).join(' ').trim();

  const createdAtDate = new Date(task.createdAt);
  const sameYear = createdAtDate.getFullYear() === new Date().getFullYear();
  const formattedDate = createdAtDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });

  const taskType = (await findLabelNameById(ctx, task.primaryLabelId)) ?? 'Task';

  return {
    taskType,
    title: `${taskType} in ${project.name || 'Project'} - ${formattedDate}${task.createdBy ? ` by ${task.createdBy.name}` : ''}`,
    description: fullText.length > 200 ? `${fullText.slice(0, 197)}...` : fullText,
    redirectUrl: new URL(`${appConfig.frontendUrl}/t/${id}`).toString(),
  };
};
