import type { DocContext } from '../constants';
import { withClient } from './db';

/** 
 * Returns raw Y.Doc binary state from PG, or null if no document exists yet.
 */
export async function loadState({ entityType, entityId, tenantId, userId }: DocContext): Promise<Uint8Array | null> {
  return withClient(tenantId, userId, async (client) => {
    const result = await client.query('SELECT state FROM yjs_documents WHERE entity_type = $1 AND entity_id = $2', [entityType, entityId]);
    if (result.rows.length === 0) return null;
    return new Uint8Array(result.rows[0].state);
  });
}

/** 
 * Overwrites the stored Y.Doc state. Called on debounced flush from the relay.
 */
export async function saveState({ entityType, entityId, tenantId, userId }: DocContext, state: Uint8Array): Promise<void> {
  await withClient(tenantId, userId, async (client) => {
    await client.query(
      `UPDATE yjs_documents SET state = $1, updated_at = now()
       WHERE entity_type = $2 AND entity_id = $3`,
      [Buffer.from(state), entityType, entityId],
    );
  });
}

/**
 * Inserts a document row on first connection, optionally with a server-side seed
 * as its initial state. No-ops if it already exists — concurrent connectors must
 * re-load afterwards and use the canonical row (two independently generated seeds
 * would duplicate content when merged).
 */
export async function createDoc(
  { entityType, entityId, tenantId, userId, organizationId }: DocContext,
  initialState?: Uint8Array | null,
): Promise<void> {
  await withClient(tenantId, userId, async (client) => {
    await client.query(
      `INSERT INTO yjs_documents (entity_type, entity_id, tenant_id, organization_id, state, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (entity_type, entity_id) DO NOTHING`,
      [entityType, entityId, tenantId, organizationId, initialState ? Buffer.from(initialState) : Buffer.alloc(0)],
    );
  });
}

/** 
 * Removes the document row after the cleanup grace period (all clients disconnected).
 */
export async function deleteState({ entityType, entityId, tenantId, userId }: DocContext): Promise<void> {
  await withClient(tenantId, userId, async (client) => {
    await client.query('DELETE FROM yjs_documents WHERE entity_type = $1 AND entity_id = $2', [entityType, entityId]);
  });
}
