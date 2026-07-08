/** Check whether a task object is a virtual draft (inline create-form placeholder). */
export const isDraftTask = (task: { _draft?: boolean }): boolean => task._draft === true;
