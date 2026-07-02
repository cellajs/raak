import { AppError } from '#/core/error';

/**
 * Per-process concurrency gate for long-lived LLM streams.
 *
 * Chat streams are I/O-bound (one open connection held for the full generation),
 * so the practical ceiling is concurrent connections + the upstream provider's
 * concurrency limit — not CPU. This gate caps active streams per worker process
 * and rejects excess requests with 429, so a stream surge degrades gracefully
 * instead of exhausting sockets/memory. Scale out by running more worker replicas.
 */

let active = 0;
const STREAM_CONCURRENCY_LIMIT = 50;

/**
 * Acquire a stream slot. Returns a `release` function that MUST be called once
 * the stream finishes (success or error). Throws 429 when the worker is at capacity.
 */
export function acquireStreamSlot(): () => void {
  if (active >= STREAM_CONCURRENCY_LIMIT) {
    throw new AppError(429, 'too_many_requests', 'warn');
  }

  active += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    active -= 1;
  };
}

/** Current number of active streams (for diagnostics / health). */
export function activeStreamCount(): number {
  return active;
}
