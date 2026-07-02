export enum TaskStatus {
  Iced = 6,
  Unstarted = 5,
  Started = 4,
  Finished = 3,
  Delivered = 2,
  Reviewed = 1,
  Accepted = 0,
}

export enum TaskVariant {
  Feature = 1,
  Chore = 2,
  Bug = 3,
}
