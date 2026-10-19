import { SquareCheckBigIcon } from 'lucide-react';
import { defineFrontendModule } from '~/lib/module';
import { TASK_SHEET_PARAM } from '~/modules/task/search-params-schemas';
// Registers the mutation defaults before the cache restore, so a queued task mutation replays after a reload
import '~/modules/task/query';

defineFrontendModule({
  name: 'tasks',
  owner: 'app',
  scope: ['frontend'],
  description: 'UI for managing tasks, including labeling, assignment, and status tracking within a project.',
  // `deepLinkParam` is the one the board and table schemas declare, so a notification opens the task sheet.
  product: { entityType: 'task', memberStatIcon: SquareCheckBigIcon, deepLinkParam: TASK_SHEET_PARAM },
});
