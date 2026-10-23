/** Whether a task is the inline create-form placeholder. */
export const isDraftTask = (task: { _draft?: boolean }): boolean => task._draft === true;
