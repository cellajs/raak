/**
 * Tests for the entity-wire factories: per-entity registration deriving
 * lens-widened wire schemas + entity-bound runtime normalizers for both
 * entity classes (product/sync and context/plain).
 *
 * `shared/version-changes` is mocked with a synthetic expand rename lens
 * (attachment.name → title, organization.welcomeText → welcomeHtml); entities
 * without lenses exercise the passthrough branches. End-to-end engine behavior
 * with real lens modules is covered in shared/src/version-changes/tests.
 */
import { z } from '@hono/zod-openapi';
import { describe, expect, it, vi } from 'vitest';

const RENAMES: Record<string, { from: string; to: string }> = {
  attachment: { from: 'name', to: 'title' },
  organization: { from: 'welcomeText', to: 'welcomeHtml' },
};

vi.mock('shared/version-changes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('shared/version-changes')>();
  return {
    ...actual,
    widenedOpsKeyMap: (entityType: string) => {
      const rename = RENAMES[entityType];
      return rename ? { [rename.from]: rename.to } : {};
    },
    normalizeOps: (
      entityType: string,
      ops: Record<string, unknown>,
      stx: { fieldTimestamps?: Record<string, unknown> },
    ) => {
      const rename = RENAMES[entityType];
      if (!rename) return { ops, stx, unknownFields: [] };
      // Synthetic expand rename: canonicalize old → new, mirror-write the twin.
      const nextOps = { ...ops };
      if (rename.from in nextOps) nextOps[rename.to] = nextOps[rename.from];
      if (rename.to in nextOps) nextOps[rename.from] = nextOps[rename.to];
      return { ops: nextOps, stx, unknownFields: [] };
    },
  };
});

import { createContextEntityWire, createProductEntityWire } from '#/core/entity-wire';

const stx = (fieldTimestamps: Record<string, string>) => ({ mutationId: 'm1', sourceId: 's1', fieldTimestamps });

describe('createProductEntityWire', () => {
  const wire = createProductEntityWire('attachment', {
    createItem: z.object({ id: z.string(), title: z.string() }),
    updatable: { title: z.string(), originalKey: z.string() },
  });

  it('derives a create item schema carrying stx, widened for the expand alias', () => {
    const item = wire.createItemSchema.parse({ id: '1', name: 'pic', stx: stx({}) });
    expect(item).toMatchObject({ id: '1', name: 'pic' });
    expect(wire.createItemSchema.parse({ id: '1', title: 'pic', stx: stx({}) })).toMatchObject({ title: 'pic' });
  });

  it('derives an update body accepting the old ops alias', () => {
    const parsed = wire.updateBodySchema.parse({ ops: { name: 'x' }, stx: stx({ name: 't' }) });
    expect(parsed.ops).toEqual({ name: 'x' });
  });

  it('keeps the static create item type intact (typed fields, not a record)', () => {
    const item = wire.createItemSchema.parse({ id: '1', title: 'pic', stx: stx({}) });
    // Compile-time: `item.title` must typecheck as string; runtime sanity below.
    expect(item.title.length).toBe(3);
    expect(item.stx.mutationId).toBe('m1');
  });

  it('binds the entityType into normalizeCreateItem', () => {
    const normalized = wire.normalizeCreateItem({ id: '1', name: 'pic', stx: stx({}) });
    expect(normalized).toMatchObject({ title: 'pic', name: 'pic' });
  });
});

describe('createContextEntityWire', () => {
  const wire = createContextEntityWire('organization', {
    createItem: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
    updateBody: z.object({ name: z.string(), welcomeHtml: z.string() }).partial(),
  });

  it('widens the partial update body with the expand alias', () => {
    expect(wire.updateBodySchema.parse({ welcomeText: 'hi' })).toEqual({ welcomeText: 'hi' });
    expect(wire.updateBodySchema.parse({ welcomeHtml: 'hi' })).toEqual({ welcomeHtml: 'hi' });
  });

  it('normalizeBody canonicalizes old keys and mirrors the twin', () => {
    expect(wire.normalizeBody({ welcomeText: 'hi' })).toEqual({ welcomeText: 'hi', welcomeHtml: 'hi' });
  });

  it('is passthrough for context entities without lenses', () => {
    const plain = createContextEntityWire('workspace', {
      createItem: z.object({ id: z.string(), name: z.string() }),
      updateBody: z.object({ name: z.string() }).partial(),
    });
    expect(plain.updateBodySchema.parse({ name: 'w' })).toEqual({ name: 'w' });
    expect(plain.normalizeBody({ name: 'w' })).toEqual({ name: 'w' });
  });
});
