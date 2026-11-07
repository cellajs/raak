import { appConfig } from 'shared';
import type { ProjectWithMembership } from '~/modules/project/types';
import { TaskStatus } from '~/modules/task/task-properties';
import type { Task, TaskLabel } from '~/modules/task/types';

const tenantId = 'demo';
const organizationId = 'demo-organization';
const createdAt = '2026-11-02T09:00:00.000Z';

const person = (slug: string, name: string) =>
  ({ id: `demo-user-${slug}`, kind: 'user', name, slug, thumbnailUrl: null, entityType: 'user' }) as const;

export const people = {
  lena: person('lena', 'Lena Vos'),
  sam: person('sam', 'Sam Okafor'),
  noor: person('noor', 'Noor Haddad'),
  tom: person('tom', 'Tom Berg'),
};

type PersonKey = keyof typeof people;

const project = (slug: string, name: string): ProjectWithMembership => ({
  id: `demo-project-${slug}`,
  entityType: 'project',
  tenantId,
  name,
  slug,
  createdAt,
  updatedAt: createdAt,
  createdBy: people.lena,
  updatedBy: people.lena,
  thumbnailUrl: null,
  bannerUrl: null,
  publishedAt: createdAt,
  public: true,
  toolsConfig: {},
  path: `${organizationId}/demo-project-${slug}`,
  organizationId,
  membership: null,
  included: {},
});

const website = project('website', 'Website');
const mobileApp = project('mobile-app', 'Mobile app');
export const demoProjects = [website, mobileApp];

/** The types a new organization starts with, so the demo's picker lists what a new team finds. */
const demoTypes = appConfig.defaultSetupConfig.primaryLabels.map(
  ({ slug, name, color, icon }): TaskLabel => ({ id: `demo-type-${slug}`, name, slug, color, mode: 'primary', icon, projectId: website.id }),
);

const demoType = (slug: string) => demoTypes.find((type) => type.slug === slug) ?? demoTypes[0];

const demoLabel = (name: string): TaskLabel => ({
  id: `demo-label-${name}`,
  name,
  slug: name,
  color: null,
  mode: 'secondary',
  icon: null,
  projectId: website.id,
});

/** A task's summary: a one-block BlockNote document. */
const summaryOf = (text: string) =>
  JSON.stringify([
    {
      id: 'demo-block',
      type: 'paragraph',
      props: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
      content: text ? [{ type: 'text', text, styles: {} }] : [],
      children: [],
    },
  ]);

interface TaskSeed {
  id: string;
  number: number;
  name: string;
  type: string;
  status: TaskStatus;
  order: number;
  in?: ProjectWithMembership;
  by?: PersonKey;
  labels?: string[];
  assigned?: PersonKey[];
}

const task = ({ id, number, name, type, status, order, in: taskProject = website, by = 'lena', labels = [], assigned = [] }: TaskSeed): Task => ({
  id: `demo-task-${id}`,
  number,
  entityType: 'task',
  tenantId,
  name,
  createdAt,
  createdBy: people[by],
  updatedAt: createdAt,
  updatedBy: people[by],
  stx: { sourceId: 'demo', mutationId: id, fieldTimestamps: {} },
  description: summaryOf(name),
  keywords: name.toLowerCase(),
  deletedAt: null,
  deletedBy: null,
  public: true,
  seq: 0,
  expandable: false,
  summary: summaryOf(name),
  summaryLength: name.length,
  primaryLabelId: demoType(type).id,
  primaryLabel: demoType(type),
  displayOrder: order,
  status,
  statusChangedAt: createdAt,
  labels: labels.map(demoLabel),
  assignedTo: assigned.map((key) => people[key]),
  checkboxCount: 0,
  checkedCount: 0,
  attachments: [],
  projectId: taskProject.id,
  organizationId,
});

const { Unstarted, Started, Finished } = TaskStatus;

export const exportTask = task({
  id: 'export',
  number: 23,
  name: 'Export tasks as CSV and PDF',
  type: 'feature',
  status: Unstarted,
  order: 2000,
  by: 'noor',
});

/** The highlights follow the hero's export task: the search finds it, two people write its todos, it is worked on offline. */
export const searchQuery = 'export';
export const searchSeed = [
  exportTask,
  task({ id: 'hl-search-pricing', number: 7, name: 'Pricing table export for sales', type: 'chore', status: Finished, order: 800 }),
  task({ id: 'hl-search-dark', number: 18, name: 'Dark mode for the settings page', type: 'feature', status: Unstarted, order: 900 }),
  task({
    id: 'hl-search-keyboard',
    number: 26,
    name: 'Export button hides behind the keyboard',
    type: 'bug',
    status: Unstarted,
    order: 900,
    in: mobileApp,
  }),
  task({ id: 'hl-search-share', number: 8, name: 'Share sheet for exported files', type: 'feature', status: Started, order: 800, in: mobileApp }),
  task({ id: 'hl-search-magic', number: 11, name: 'Sign in with a magic link', type: 'feature', status: Started, order: 700, in: mobileApp }),
];

// The first is shorter than the second, so the teammate's name label above the second's end clears it
export const exportTodos = ['CSV download', 'PDF built on the server', 'Mail the file when it is ready'] as const;
export const exportTodosWhy = 'Customers want their tasks in a spreadsheet, and on paper for the weekly meeting.';

const checklistBlock = (text: string, index: number, checked: boolean) => ({
  id: `demo-todo-${index}`,
  type: 'checklistItem',
  props: { textColor: 'default', textAlignment: 'left', checkboxId: `demo-todo-${index}`, checked },
  content: [{ type: 'text', text, styles: {} }],
  children: [],
});

/** Offline the PDF todo is ticked too: the card holds it until the connection is back. */
export const offlineTask: Task = {
  ...task({
    id: 'hl-offline-export',
    number: exportTask.number,
    name: exportTask.name,
    type: 'feature',
    status: Started,
    order: 900,
    by: 'noor',
    assigned: ['sam'],
  }),
  expandable: true,
  description: JSON.stringify([
    ...JSON.parse(summaryOf(exportTask.name)),
    ...exportTodos.map((todo, index) => checklistBlock(todo, index, index < 2)),
  ]),
  checkboxCount: exportTodos.length,
  checkedCount: 2,
};
