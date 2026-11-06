import { createContext } from 'react';

/** True below a demo playing made-up tasks on a page outside the app: they are never marked seen and offer nothing to create. */
export const TaskDemoScope = createContext(false);
