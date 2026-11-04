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

export const website = project('website', 'Website');
export const mobileApp = project('mobile-app', 'Mobile app');
export const demoProjects = [website, mobileApp];

/** The types a new organization starts with, so the demo's picker lists what a new team finds. */
export const demoTypes = appConfig.defaultSetupConfig.primaryLabels.map(
  ({ slug, name, color, icon }): TaskLabel => ({ id: `demo-type-${slug}`, name, slug, color, mode: 'primary', icon, projectId: website.id }),
);

export const demoType = (slug: string) => demoTypes.find((type) => type.slug === slug) ?? demoTypes[0];

export const demoLabel = (name: string): TaskLabel => ({
  id: `demo-label-${name}`,
  name,
  slug: name,
  color: null,
  mode: 'secondary',
  icon: null,
  projectId: website.id,
});

/** A task's summary: a one-block BlockNote document. */
export const summaryOf = (text: string) =>
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

const { Unstarted, Started, Finished, Reviewed } = TaskStatus;

const heroImagesTask = task({
  id: 'images',
  number: 12,
  name: 'Compress the hero images',
  type: 'chore',
  status: Finished,
  order: 900,
  assigned: ['sam'],
});
export const darkModeTask = task({
  id: 'dark-mode',
  number: 18,
  name: 'Dark mode for the settings page',
  type: 'feature',
  status: Unstarted,
  order: 900,
  assigned: ['noor'],
});
export const typoTask = task({ id: 'typo', number: 19, name: 'Typo on the pricing page', type: 'bug', status: Unstarted, order: 800, by: 'sam' });
export const syncStateTask = task({
  id: 'sync-state',
  number: 21,
  name: 'Show the sync state in the header',
  type: 'feature',
  status: Unstarted,
  order: 800,
  in: mobileApp,
});
export const exportTask = task({
  id: 'export',
  number: 23,
  name: 'Export tasks to a spreadsheet',
  type: 'feature',
  status: Unstarted,
  order: 2000,
  by: 'noor',
});

/** What the board starts from: few rows, as everything that changes must stand on the first screen, and on a phone in the three its frame holds. */
export const demoSeed = (isPhone: boolean) => [
  ...(isPhone ? [] : [heroImagesTask]),
  darkModeTask,
  typoTask,
  task({
    id: 'offline',
    number: 9,
    name: 'Offline mode for the task list',
    type: 'feature',
    status: Reviewed,
    order: 900,
    in: mobileApp,
    assigned: ['sam'],
  }),
  task({
    id: 'magic-link',
    number: 11,
    name: 'Sign in with a magic link',
    type: 'feature',
    status: Started,
    order: 900,
    in: mobileApp,
    labels: ['auth'],
    assigned: ['tom'],
  }),
  task({
    id: 'push',
    number: 16,
    name: 'Push notification opens the wrong task',
    type: 'bug',
    status: Unstarted,
    order: 900,
    in: mobileApp,
    assigned: ['tom'],
  }),
  syncStateTask,
];
