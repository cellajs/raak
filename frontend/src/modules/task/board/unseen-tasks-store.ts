import { create } from 'zustand';
import { TaskStatus } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';
import { useUserStore } from '~/modules/user/user-store';

interface UnseenTasksState {
  ids: Set<string>;
  replace: (ids: string[]) => void;
  add: (ids: string[]) => void;
  remove: (id: string) => void;
  clear: () => void;
}

/** Tasks new to the user on this board visit. A snapshot, not live state: `SeenMark` records a card as soon as it scrolls into view. */
export const useUnseenTasksStore = create<UnseenTasksState>()((set) => ({
  ids: new Set(),
  replace: (ids) => set({ ids: new Set(ids) }),
  add: (ids) => set((state) => ({ ids: new Set([...state.ids, ...ids]) })),
  remove: (id) =>
    set((state) => {
      if (!state.ids.has(id)) return state;
      const ids = new Set(state.ids);
      ids.delete(id);
      return { ids };
    }),
  clear: () => set({ ids: new Set() }),
}));

/** Whether a card shows its unseen mark. The user's own tasks and finished or parked ones never do, though the menu badge counts them. */
export const useShowsUnseenMark = (task: Pick<Task, 'id' | 'status' | 'createdBy'>) => {
  const isUnseen = useUnseenTasksStore((state) => state.ids.has(task.id));
  const isOwn = useUserStore((state) => state.user?.id === task.createdBy?.id);
  return isUnseen && !isOwn && task.status !== TaskStatus.Accepted && task.status !== TaskStatus.Iced;
};
