import { defineScenario } from '../src/runner';
import { taskEditVu } from '../src/task-edit-vu';

/**
 * Task edit step-up: looping VUs find the throughput ceiling. Each VU edits 5 times, cycling through the edit types
 * (assignedTo, displayOrder, status, description). Steps up 50 → 100 → 125 arrivals/s (~625 req/s peak). Task edits are
 * heavier than attachments (5-6 DB round-trips vs 3).
 */
export default defineScenario({
  description: 'Task edit step-up: looping VUs find the throughput ceiling.',
  phases: [
    { name: 'hold 50', duration: 10, arrivalRate: 50 },
    { name: 'hold 100', duration: 10, arrivalRate: 100 },
    { name: 'hold 125', duration: 15, arrivalRate: 125 },
  ],
  checks: { maxErrorRate: 1, thresholds: { 'http.response_time.p95': 3000 } },
  vu: (vu) => taskEditVu(vu, 5),
});
