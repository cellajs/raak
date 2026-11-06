import { z } from '@hono/zod-openapi';
import { TaskStatus } from '#/modules/task/task-properties';
import { isoDateAgo } from '#/utils/iso-date';
import { TimeSpan } from '#/utils/time-span';
import sampleJson from '#json/sample-content.json';

const ageUnits = { min: 'm', h: 'h', d: 'd', w: 'w' } as const;
const agePattern = /^(\d+)(min|h|d|w)$/;

const statusByName = {
  accepted: TaskStatus.Accepted,
  reviewed: TaskStatus.Reviewed,
  finished: TaskStatus.Finished,
  started: TaskStatus.Started,
  unstarted: TaskStatus.Unstarted,
  iced: TaskStatus.Iced,
} as const;

/** A duration before the provisioning, written as the showcase writes it: 25min, 2h, 3d or 1w. */
const ageSchema = z.string().regex(agePattern);

const ageMs = (age: string) => {
  const [, amount, unit] = agePattern.exec(age) ?? [];
  return new TimeSpan(Number(amount), ageUnits[unit as keyof typeof ageUnits]).milliseconds();
};

const sampleContentSchema = z
  .object({
    people: z.array(z.object({ key: z.string(), id: z.uuid(), firstName: z.string(), lastName: z.string() })).min(1),
    projects: z
      .array(z.object({ key: z.string(), name: z.string(), by: z.string(), age: ageSchema, labels: z.array(z.string()).default([]) }))
      .min(1),
    tasks: z.array(
      z.object({
        /** The number the task gets in an organization without tasks: tasks are listed by it, from 1 up. */
        number: z.int().positive(),
        project: z.string(),
        name: z.string().min(1),
        /** Slug of a task type; an organization without it gives the task its first type. */
        type: z.string(),
        status: z.enum(Object.keys(statusByName) as [keyof typeof statusByName, ...(keyof typeof statusByName)[]]),
        by: z.string(),
        assigned: z.array(z.string()).default([]),
        labels: z.array(z.string()).default([]),
        age: ageSchema,
        /** Since the last status change; the task's age when absent. */
        statusAge: ageSchema.optional(),
        text: z.array(z.string()).default([]),
        todos: z.array(z.object({ text: z.string(), done: z.boolean() })).default([]),
      }),
    ),
  })
  .superRefine(({ people, projects, tasks }, issue) => {
    const personKeys = new Set(people.map(({ key }) => key));
    const projectLabels = new Map(projects.map(({ key, labels }) => [key, new Set(labels)]));
    const refuse = (message: string) => issue.addIssue({ code: 'custom', message: `json/sample-content.json: ${message}` });

    if (personKeys.size < people.length || new Set(people.map(({ id }) => id)).size < people.length) refuse('a person key or id repeats');
    if (projectLabels.size < projects.length) refuse('a project key repeats');
    for (const project of projects) if (!personKeys.has(project.by)) refuse(`project ${project.key} is by unknown person ${project.by}`);

    for (const [index, task] of tasks.entries()) {
      const name = `task ${task.number}`;
      if (task.number !== index + 1) refuse(`${name} is listed at position ${index + 1}`);
      const labels = projectLabels.get(task.project);
      if (!labels) refuse(`${name} is in unknown project ${task.project}`);
      for (const key of [task.by, ...task.assigned]) if (!personKeys.has(key)) refuse(`${name} names unknown person ${key}`);
      for (const label of task.labels) if (!labels?.has(label)) refuse(`${name} has label ${label}, which its project does not list`);
      if (task.statusAge && ageMs(task.statusAge) > ageMs(task.age)) refuse(`${name} changed status before it was created`);
    }
  });

export type SampleContent = z.infer<typeof sampleContentSchema>;
export type SampleTask = SampleContent['tasks'][number];

/** The sample team, its two projects and their tasks, which every organization's sample is provisioned from. */
export const sampleContent: SampleContent = sampleContentSchema.parse(sampleJson);

/** The accounts of the sample team: shared by every organization with the sample, never signed in, never mailed. */
export const samplePersonIds = sampleContent.people.map(({ id }) => id);

/** The account id of a person in the dataset. */
export const samplePersonId = (key: string) => {
  const person = sampleContent.people.find((candidate) => candidate.key === key);
  if (!person) throw new Error(`json/sample-content.json: no person ${key}`);
  return person.id;
};

/** The moment `age` before now. */
export const sampleMoment = (age: string) => isoDateAgo(new TimeSpan(ageMs(age), 'ms'));

/** The stored status of a dataset status name. */
export const sampleStatus = (name: SampleTask['status']) => statusByName[name];
