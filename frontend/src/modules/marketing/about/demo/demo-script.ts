import {
  darkModeTask,
  demoLabel,
  demoType,
  exportTask,
  mobileApp,
  people,
  summaryOf,
  syncStateTask,
  typoTask,
  website,
} from '~/modules/marketing/about/demo/fixtures';
import { taskFieldTriggerId } from '~/modules/task/helpers/open-task-dropdown';
import { TaskStatus } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';

const cardSelector = (id: string) => `[data-task-card-id="${id}"]`;
const fieldSelector = (field: 'labels' | 'primaryLabel', id: string) => `[id="${taskFieldTriggerId(field, id, false)}"]`;
const statusSelector = (id: string) => `[data-task-status-control="${id}"]`;

const demoTypeRowSelector = (slug: string) => `[data-demo-type="${slug}"]`;

/** What the script does to the board; the board implements it, a test records it. */
export interface DemoStage {
  isPhone: boolean;
  sleep: (ms: number) => Promise<void>;
  /** Walks the cursor to an element of the board, under a teammate's name when one takes over. */
  point: (selector: string, name?: string) => void;
  press: () => Promise<void>;
  hideCursor: () => void;
  addTask: (task: Task) => void;
  patchTask: (id: string, change: (task: Task) => Partial<Task>) => void;
  /** Gives a task the look of the current card and, unless still being typed, its glow. */
  emphasize: (id: string, glow?: boolean) => void;
  markNew: (id: string) => void;
  openTypeMenu: (task: Task) => void;
  highlightType: (typeId: string) => void;
  closeTypeMenu: () => void;
  /** Lifts a task's card onto the cursor. */
  carry: (id: string) => void;
  /** Walks the carrying cursor to the foot of a card, and shows where the task lands. */
  carryTo: (landingTaskId: string) => void;
  drop: () => void;
  /** Drags the divider between the panels this far to the right, with the cursor on it. */
  dragDivider: (distance: number) => Promise<void>;
  /** Shows another project's tab on a phone. */
  showProject: (projectId: string) => void;
  /** Fades the board back to the seed. */
  reset: () => Promise<void>;
}

const addTask = async (stage: DemoStage) => {
  const { id, name } = exportTask;
  stage.point(cardSelector(darkModeTask.id), people.noor.name.split(' ')[0]);
  await stage.sleep(800);
  stage.addTask({ ...exportTask, name: '', summary: summaryOf('') });
  stage.emphasize(id, false);
  for (let length = 1; length <= name.length; length += 1) {
    stage.patchTask(id, () => ({ name: name.slice(0, length), summary: summaryOf(`${name.slice(0, length)}▏`) }));
    await stage.sleep(48);
  }
  await stage.sleep(450);
  stage.patchTask(id, () => ({ summary: summaryOf(name) }));
  stage.markNew(id);
  stage.emphasize(id);
  await stage.sleep(1500);
};

const startTask = async (stage: DemoStage) => {
  const { id } = darkModeTask;
  stage.point(statusSelector(id), people.lena.name.split(' ')[0]);
  await stage.sleep(1000);
  await stage.press();
  stage.patchTask(id, () => ({
    status: TaskStatus.Started,
    statusChangedAt: new Date().toISOString(),
    assignedTo: [people.noor, people.lena],
  }));
  stage.emphasize(id);
  await stage.sleep(1700);
};

const changeType = async (stage: DemoStage) => {
  const { id } = typoTask;
  const chore = demoType('chore');
  stage.point(fieldSelector('primaryLabel', id), people.sam.name.split(' ')[0]);
  await stage.sleep(1000);
  await stage.press();
  stage.openTypeMenu(typoTask);
  await stage.sleep(stage.isPhone ? 650 : 500);
  stage.point(demoTypeRowSelector(chore.slug));
  await stage.sleep(750);
  stage.highlightType(chore.id);
  await stage.sleep(260);
  await stage.press();
  stage.closeTypeMenu();
  stage.patchTask(id, () => ({ primaryLabel: chore, primaryLabelId: chore.id }));
  stage.emphasize(id);
  await stage.sleep(1300);
};

const addLabel = async (stage: DemoStage) => {
  const { id } = typoTask;
  stage.point(fieldSelector('labels', id));
  await stage.sleep(1000);
  await stage.press();
  stage.patchTask(id, (task) => ({ labels: [...task.labels, demoLabel('copy')] }));
  stage.emphasize(id);
  await stage.sleep(1500);
};

const moveTask = async (stage: DemoStage) => {
  const { id } = syncStateTask;
  stage.point(cardSelector(id), people.tom.name.split(' ')[0]);
  await stage.sleep(1000);
  stage.carry(id);
  await stage.sleep(350);
  stage.carryTo(typoTask.id);
  await stage.sleep(1150);
  stage.drop();
  stage.patchTask(id, () => ({ projectId: website.id, displayOrder: 700 }));
  stage.emphasize(id);
  await stage.sleep(1800);
};

const resizePanels = async (stage: DemoStage) => {
  stage.point('[role="separator"]');
  await stage.sleep(1000);
  await stage.dragDivider(180);
  await stage.sleep(1500);
};

const openOtherProject = async (stage: DemoStage) => {
  stage.point(`[data-tab="${mobileApp.id}"]`);
  await stage.sleep(1000);
  await stage.press();
  stage.showProject(mobileApp.id);
  await stage.sleep(2200);
};

/** One round of a team at work: a task added, started, retyped and labelled. Then two panels share a move and a resize, or a phone opens the other project. */
export const playDemoRound = async (stage: DemoStage) => {
  await stage.sleep(1400);
  await addTask(stage);
  await startTask(stage);
  await changeType(stage);
  await addLabel(stage);
  // A phone cannot move a task to another project, and shows one at a time
  if (stage.isPhone) {
    await openOtherProject(stage);
  } else {
    await moveTask(stage);
    await resizePanels(stage);
  }
  stage.hideCursor();
  await stage.sleep(1100);
  await stage.reset();
};
