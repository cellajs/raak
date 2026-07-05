/**
 * Maple.dev browser observability (errors + session replay + trace correlation).
 *
 * Captures uncaught errors, unhandled rejections, console output, network
 * failures and rrweb session replay, all tagged with a shared session id and
 * the active trace id. Ships to Maple with the browser-safe *public* ingest
 * key — same key/CSP surface as the existing OTLP trace export in lib/otel.ts.
 *
 * Tracing ownership: our WebTracerProvider (lib/otel.ts) registers first and
 * stays the global tracer (it feeds the devtools SpanStore and exports to
 * Maple). The SDK's fetch auto-instrumentation is disabled to avoid duplicate
 * network spans — the SDK's docs bless exactly this setup when another tracer
 * already instruments requests. Revisit letting the SDK own tracing (spans
 * then carry session.id) after the trial (.todos/21).
 *
 * Privacy: inputs AND rendered text are masked before anything leaves the
 * browser (multi-tenant content must not end up in replays by default).
 * Enabled outside development; dev opt-in via VITE_DEBUG_MODE.
 */
import { MapleBrowser } from '@maple-dev/browser';
import { appConfig } from 'shared';
import { isDebugMode } from '~/env';
import { useUserStore } from '~/modules/user/user-store';

const enabled = !!appConfig.maplePublicIngestKey && (appConfig.mode !== 'development' || isDebugMode);

if (enabled) {
  MapleBrowser.init({
    ingestKey: appConfig.maplePublicIngestKey,
    serviceName: `${appConfig.slug}-frontend`,
    environment: appConfig.mode,
    serviceVersion: __APP_VERSION__,
    tracing: { instrumentFetch: false },
    replay: { sampleRate: 1 },
    privacy: { maskAllInputs: true, maskAllText: true },
  });

  // Attach the (opaque) user id to the session once known; safe to call repeatedly.
  const identify = (userId?: string) => userId && MapleBrowser.identify(userId);
  identify(useUserStore.getState().user?.id);
  useUserStore.subscribe((state, prev) => {
    if (state.user?.id && state.user.id !== prev.user?.id) identify(state.user.id);
  });
}

/**
 * Structured funnel for errors caught by React (boundaries/root). console.error
 * is the SDK's capture path (it wraps console), so this both keeps local
 * visibility and lands the error on the Maple session timeline.
 */
export const reportReactError = (scope: string, error: unknown, componentStack?: string | null) => {
  console.error(`[react:${scope}]`, error, componentStack ? `\n${componentStack}` : '');
};
