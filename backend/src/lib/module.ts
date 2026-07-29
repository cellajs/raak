import type { ProductEntityType } from 'shared';
import { type ModuleConfig, registerModule } from 'shared/module-registry';
import type { YjsMaterializer } from '#/modules/yjs/yjs-materializers';

/**
 * A backend module's registration: shared metadata plus backend-only capabilities. Subsystems
 * build their own index from these via {@link onBackendModuleRegister}, so a module declares its
 * capabilities in one place instead of calling a separate register* function per subsystem.
 */
export interface BackendModule extends ModuleConfig {
  /** The product entity this module owns, keying the capabilities below. */
  entity?: ProductEntityType;
  /** Yjs collab-session materializer for `entity` (indexed by yjs-materializers). */
  yjsMaterializer?: YjsMaterializer;
}

const backendModules: BackendModule[] = [];
const listeners: ((module: BackendModule) => void)[] = [];

/**
 * Register a backend module. Metadata flows to the shared module registry; capabilities flow to
 * backend projections listening via {@link onBackendModuleRegister}. Call once at module-load time
 * in the module's `*-module.ts`.
 */
export function defineBackendModule(module: BackendModule): void {
  const { entity: _entity, yjsMaterializer: _yjsMaterializer, ...metadata } = module;
  registerModule(metadata);
  backendModules.push(module);
  for (const listener of listeners) listener(module);
}

/** Subscribe to backend module registrations; replays modules already registered. */
export function onBackendModuleRegister(listener: (module: BackendModule) => void): void {
  listeners.push(listener);
  for (const module of backendModules) listener(module);
}
