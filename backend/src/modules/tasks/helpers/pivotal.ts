import { nanoid } from 'nanoid';
import type { InsertTaskModel } from '#/db/schema/tasks';
import type { UserModel } from '#/db/schema/users';
import { extractKeywords } from '#/modules/tasks/helpers/utils';
import type { PivotalTask } from './pivotal-type';

export enum PivotalTaskTypes {
  feature = 1,
  chore = 2,
  bug = 3,
}

export const getSubtask = (task: PivotalTask, taskId: string, organizationId: string, projectId: string) => {
  const subtasks: InsertTaskModel[] = [];
  for (let i = 0; i <= 27; i++) {
    const taskKey = `Task_${i}` as keyof PivotalTask;
    const statusKey = `Task Status_${i}` as keyof PivotalTask;
    if (task[taskKey] && task[statusKey]) {
      subtasks.push({
        id: nanoid(),
        summary: `<p class="bn-inline-content inline">${task[taskKey]}</p>`,
        type: PivotalTaskTypes.chore,
        keywords: extractKeywords(task[taskKey]),
        parentId: taskId,
        organizationId: organizationId,
        projectId: projectId,
        impact: 0,
        description: `<div class="bn-block-content"><p class="bn-inline-content">${task[taskKey]}</p></div>`,
        status: task[statusKey] === 'completed' ? 6 : 0,
        order: i,
        createdAt: new Date(),
        expandable: false,
      });
    }
  }
  return subtasks;
};

export const getLabels = (
  tasks: PivotalTask[],
  organizationId: string,
  projectId: string,
  existingLabels: { id: string; name: string; useCount: number }[],
) => {
  // Flatten the labels from tasks and filter out empty ones
  const labels = tasks.flatMap((t) => t.Labels?.split(', ') || []).filter((l) => l?.length);

  // Count occurrences of each label
  const labelCounts = labels.reduce(
    (acc, label) => {
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const labelsToInsert = [];
  const labelsToUpdate = [];

  for (const [key, value] of Object.entries(labelCounts)) {
    const existingLabel = existingLabels.find((label) => label.name === key);

    if (existingLabel) {
      labelsToUpdate.push({
        id: existingLabel.id,
        name: key,
        useCount: value + existingLabel.useCount,
      });
    } else {
      labelsToInsert.push({
        id: nanoid(),
        name: key,
        color: '#FFA9BA',
        organizationId: organizationId,
        projectId: projectId,
        lastUsedAt: new Date(),
        useCount: value,
      });
    }
  }

  return { labelsToInsert, labelsToUpdate };
};

export const getTaskLabels = (task: PivotalTask, labelsToInsert: { id: string; name: string }[]) => {
  const taskLabels = task.Labels?.split(', ').filter((l) => l?.length) || [];
  const labelsIds = taskLabels
    .map((taskLabel) => labelsToInsert.find((label) => label.name === taskLabel)?.id)
    .filter((id) => typeof id === 'string');
  return labelsIds;
};

export const getTaskUsers = (task: PivotalTask, taskMembers: UserModel[]) => {
  const ownersNames = Object.keys(task)
    .filter((key) => key.includes('Owned By')) // Find keys that include 'Owned By'
    .map((key) => task[key as keyof PivotalTask]) // Get the corresponding values
    .filter(Boolean);

  const creatorName = task['Requested By'];
  const creator = taskMembers.find((u) => checkNames(u, [creatorName]));
  const ownerIds = taskMembers.filter((u) => checkNames(u, ownersNames)).map((u) => u.id);
  return { ownerIds, creatorId: creator?.id, ownersNames };
};

// Check if it matches name or firstName or firstName + lastName
const checkNames = (user: UserModel, names: (string | undefined)[]) => {
  const { name, firstName, lastName } = user;
  const fullName = `${firstName || ''}${lastName || ''}`.trim().toLowerCase().replace(/\s+/g, '');
  return names.some((n) => {
    const lowerName = n?.toLowerCase().replace(/\s+/g, ''); // Convert to lowercase and remove spaces
    return (
      lowerName === name.toLowerCase().replace(/\s+/g, '') ||
      (firstName && lowerName === firstName.toLowerCase().replace(/\s+/g, '')) ||
      lowerName === fullName
    );
  });
};
