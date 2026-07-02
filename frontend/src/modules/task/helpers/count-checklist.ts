export const countChecklistItems = (checkboxCount: number | undefined, checkedCount: number | undefined) => {
  return { checked: checkedCount ?? 0, total: checkboxCount ?? 0 };
};
