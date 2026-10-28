export enum TaskStatus {
  Iced = 6,
  Unstarted = 5,
  Started = 4,
  Finished = 3,
  Delivered = 2,
  Reviewed = 1,
  Accepted = 0,
}

/** Every status, in declaration order. */
export const taskStatuses = Object.values(TaskStatus).filter((status): status is TaskStatus => typeof status === 'number');
