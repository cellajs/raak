import { defineScenario } from '../src/runner';
import { taskEditVu } from '../src/task-edit-vu';

/**
 * Measures CDC pipeline lag under increasing write load: the task-edit payloads at a heavier sustained profile. The CLI
 * waits for the CDC worker to catch up after every scenario, so the time it still needed is in the run summary. Each VU
 * edits 10 times. Steps up 25 → 50 → 75 → 100 arrivals/s.
 */
export default defineScenario({
  description: 'CDC throughput: task edits at a sustained, rising rate to push the CDC pipeline.',
  phases: [
    { name: 'hold 25', duration: 10, arrivalRate: 25 },
    { name: 'hold 50', duration: 10, arrivalRate: 50 },
    { name: 'hold 75', duration: 10, arrivalRate: 75 },
    { name: 'hold 100', duration: 10, arrivalRate: 100 },
  ],
  checks: { maxErrorRate: 1, thresholds: { 'http.response_time.p95': 3000 } },
  vu: (vu) => taskEditVu(vu, 10),
});
