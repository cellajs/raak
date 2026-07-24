import { ORG_ID, TENANT_ID, taskId } from '../seeds/ids';
import { TOTAL_TASKS } from '../seeds/task.bench';
import { allEditBuilders } from './task-edits';

export { authenticate } from './auth';

let iterCount = 0;

/**
 * Builds task edit payloads (assignedTo, displayOrder, status, description) and
 * sets context variables for the YAML scenario flow.
 */
export function buildTaskEditPayload(context: { vars: Record<string, unknown> }, _events: unknown, done: () => void) {
  const userIndex = (context.vars.userIndex as number) ?? 0;
  const tId = taskId(userIndex % TOTAL_TASKS);

  context.vars.tenantId = TENANT_ID;
  context.vars.orgId = ORG_ID;
  context.vars.taskId = tId;
  context.vars.payload = allEditBuilders[iterCount++ % allEditBuilders.length]();
  done();
}
