import { createContext, useContext } from 'react';
import type { Task } from '~/modules/task/types';

/** The tasks a board panel renders, in render order. Null outside a panel, such as in a task sheet. */
export const PanelTasksContext = createContext<Task[] | null>(null);

export const usePanelTasks = () => useContext(PanelTasksContext);
