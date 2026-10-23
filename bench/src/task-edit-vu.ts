import { benchUser, ORG_PATH } from './bench-user';
import type { Vu } from './runner/types';
import { taskId } from './seeds/ids';
import { TOTAL_TASKS } from './seeds/task.bench';
import { allEditBuilders } from './task-edits';

/** The VU of both task scenarios: `loops` edits of the user's own task, cycling through the edit types. */
export async function taskEditVu(vu: Vu, loops: number) {
  const { cookie, userIndex } = benchUser(vu.index);
  for (let i = 0; i < loops; i++) {
    await vu.http.put(`${ORG_PATH}/tasks/${taskId(userIndex % TOTAL_TASKS)}`, {
      json: allEditBuilders[i % allEditBuilders.length](),
      headers: { cookie },
      name: 'PUT /tasks/:id',
    });
    await vu.think(50);
  }
}
