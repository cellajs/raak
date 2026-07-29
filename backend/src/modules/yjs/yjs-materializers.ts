import type { ProductEntityType } from 'shared';
import type { AuthContext } from '#/core/context';
import { onBackendModuleRegister } from '#/lib/module';

export interface YjsMaterializeInput {
  entityId: string;
  /** Serialized BlockNote blocks, sanitized before persistence. */
  description: string;
}

/**
 * Persists a Yjs collab session's description for one entity type, typically through a thin
 * wrapper around the entity's standard update operation with `ops: { description }`
 * and a server-origin stx (empty `fieldTimestamps` → the pipeline stamps a server HLC).
 */
export type YjsMaterializer = (ctx: AuthContext, input: YjsMaterializeInput) => Promise<void>;

const materializers = new Map<ProductEntityType, YjsMaterializer>();

// Index the materializer each backend module declares (see defineBackendModule); replaces the
// former registerYjsMaterializer call.
onBackendModuleRegister((module) => {
  if (module.entity && module.yjsMaterializer) materializers.set(module.entity, module.yjsMaterializer);
});

export function getYjsMaterializer(entityType: ProductEntityType): YjsMaterializer | undefined {
  return materializers.get(entityType);
}
