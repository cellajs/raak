import type { Project } from 'sdk';
import { pointsOptionsByValue, statusOptionsByValue } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';

export const configureForExport = (tasks: Task[], projects: Omit<Project, 'counts'>[]): Task[] => {
  const parser = new DOMParser();

  return tasks.map((task) => {
    //Parse the HTML and extract text content
    const summaryDoc = parser.parseFromString(task.summary, 'text/html');
    const summaryText = summaryDoc.body.textContent || '';

    const project = projects.find((p) => p.id === task.projectId);
    const points = pointsOptionsByValue[task.points ?? 0];
    return {
      ...task,
      summary: summaryText,
      labels: task.labels.map((label) => label.name),
      status: statusOptionsByValue[task.status].status,
      points: points.value,
      projectId: project?.name ?? '-',
      createdBy: task.createdBy?.name ?? '-',
      updatedBy: task.updatedBy?.name ?? '-',
      assignedTo: task.assignedTo.map((m) => m.name) || '-',
    } as unknown as Task;
  });
};
