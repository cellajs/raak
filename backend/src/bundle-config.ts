/**
 * Packages the app's service bundles load from disk (a native addon, a driver the tracing SDK patches); see `keepOnDisk`.
 * Imported by every service's `tsup.config.ts`, which no tsconfig covers, so only a build reports a mistake here.
 * @public
 */
// fork: @napi-rs/canvas, raak's native addon for task covers, loads by platform-specific .node file
export const appKeepOnDisk: readonly string[] = ['@napi-rs/canvas'];
