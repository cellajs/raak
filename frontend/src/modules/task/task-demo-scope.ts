import { createContext } from 'react';

/** True below a demo playing made-up tasks on a page outside the app: they are never marked seen and offer nothing to create. */
export const TaskDemoScope = createContext(false);

/** True below a demo that plays the app offline, while the page itself stays online. */
export const TaskDemoOffline = createContext(false);
