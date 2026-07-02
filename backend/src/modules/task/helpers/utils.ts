export const getDateFromToday = (days: number): string => {
  // Calculate the date 'days' ago from today
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - days);
  return targetDate.toISOString();
};
