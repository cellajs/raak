import type { Project } from 'sdk';
import { titleFromDocument } from 'shared/blocknote';
import { statusOptionsByValue } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';

/** Printable export rows: names in place of ids and label objects. */
export const configureForExport = (tasks: Task[], projects: Omit<Project, 'counts'>[]): Task[] => {
  return tasks.map((task) => {
    const project = projects.find(({ id }) => id === task.projectId);
    return {
      ...task,
      summary: titleFromDocument(task.summary),
      labels: task.labels.map((label) => label.name),
      primaryLabelId: task.primaryLabel?.name ?? '-',
      status: statusOptionsByValue[task.status].status,
      projectId: project?.name ?? '-',
      createdBy: task.createdBy?.name ?? '-',
      updatedBy: task.updatedBy?.name ?? '-',
      assignedTo: task.assignedTo.map((member) => member.name),
    } as unknown as Task;
  });
};
