import type { MobileTaskDropIndicator } from '~/modules/task/board/mobile-drag-indicator-store';
import type { Task } from '~/modules/task/types';

const taskCardSelector = '[data-task-card-id][data-project-id][data-status]:not([data-sheet="true"])';

const coarsePointerQuery = '(pointer: coarse)';

export const isCoarsePointerDevice = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(coarsePointerQuery).matches;
};

export const resolveMobileTaskDropIndicator = ({
  clientX,
  clientY,
  sourceTask,
}: {
  clientX: number;
  clientY: number;
  sourceTask: Pick<Task, 'id' | 'projectId' | 'status'>;
}): MobileTaskDropIndicator | null => {
  if (typeof document === 'undefined') return null;

  const cards = Array.from(document.querySelectorAll<HTMLElement>(taskCardSelector))
    .filter((element) => element.dataset.taskCardId !== sourceTask.id)
    .filter((element) => Number(element.dataset.status) === sourceTask.status)
    .filter((element) => {
      if (element.dataset.projectId === sourceTask.projectId) return true;
      return element.dataset.readOnly !== 'true';
    })
    .map((element) => ({ element, rect: element.getBoundingClientRect() }))
    .filter(({ rect }) => rect.height > 0 && rect.width > 0);

  if (!cards.length) return null;

  const overlappingCards = cards.filter(
    ({ rect }) =>
      clientX >= rect.left - 24 && clientX <= rect.right + 24 && clientY >= rect.top && clientY <= rect.bottom,
  );

  const candidate = (overlappingCards.length ? overlappingCards : cards).toSorted((left, right) => {
    const leftDistance = getVerticalDistance(left.rect, clientY);
    const rightDistance = getVerticalDistance(right.rect, clientY);
    return leftDistance - rightDistance;
  })[0];

  if (!candidate) return null;

  return {
    edge: clientY < candidate.rect.top + candidate.rect.height / 2 ? 'top' : 'bottom',
    taskId: candidate.element.dataset.taskCardId ?? '',
  };
};

function getVerticalDistance(rect: DOMRect, clientY: number) {
  if (clientY < rect.top) return rect.top - clientY;
  if (clientY > rect.bottom) return clientY - rect.bottom;
  return 0;
}
