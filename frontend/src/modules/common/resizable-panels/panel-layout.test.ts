import { describe, expect, it } from 'vitest';
import { type DragState, type PanelConfig, resolveLayout } from '~/modules/common/resizable-panels/panel-layout';

const panel = (id: string, overrides: Partial<PanelConfig> = {}): PanelConfig => ({
  id,
  minWidth: 300,
  collapsedWidth: 50,
  collapsible: true,
  ...overrides,
});

const dragOf = (widths: Record<string, number>, separatorIndex: number, autoFill = true): DragState => ({
  separatorIndex,
  startX: 0,
  autoFill,
  initialWidths: widths,
  collapsedAtStart: new Set(Object.keys(widths).filter((id) => widths[id] <= 50)),
});

const resolve = (widths: Record<string, number>, separatorIndex: number, dx: number, autoFill = true) =>
  resolveLayout(
    Object.keys(widths).map((id) => panel(id)),
    dragOf(widths, separatorIndex, autoFill),
    dx,
  );

describe('resolveLayout', () => {
  it('leaves everything in place without a delta', () => {
    expect(resolve({ a: 400, b: 400 }, 0, 0)).toEqual({ widths: { a: 400, b: 400 }, hints: [] });
  });

  it('G1: the panel the separator moves away from grows', () => {
    expect(resolve({ a: 500, b: 500 }, 0, 100).widths).toEqual({ a: 600, b: 400 });
    expect(resolve({ a: 500, b: 500 }, 0, -100).widths).toEqual({ a: 400, b: 600 });
  });

  describe('G2: collapse snap', () => {
    it('freezes at minWidth through the zone and hints its progress', () => {
      const { widths, hints } = resolve({ a: 450, b: 350 }, 0, 100);
      expect(widths).toEqual({ a: 500, b: 300 });
      expect(hints[0]).toMatchObject({ panelId: 'b', mode: 'collapse', side: 'left' });
      expect(hints[0].progress).toBeGreaterThan(0);
    });

    it('snaps past the snap point, the md example', () => {
      expect(resolve({ a: 450, b: 350 }, 0, 250).widths).toEqual({ a: 750, b: 50 });
    });

    it('reverses when dragged back', () => {
      expect(resolve({ a: 450, b: 350 }, 0, 40).widths).toEqual({ a: 490, b: 310 });
    });
  });

  describe('G3: expand gate', () => {
    it('holds the layout and hints the neighbour until the full distance', () => {
      const { widths, hints } = resolve({ a: 500, b: 50 }, 0, -249);
      expect(widths).toEqual({ a: 500, b: 50 });
      expect(hints.map(({ panelId, mode }) => [panelId, mode])).toEqual([
        ['b', 'expand'],
        ['a', 'cover'],
      ]);
    });

    it('snaps to minWidth at the full distance, the md example', () => {
      expect(resolve({ a: 500, b: 50 }, 0, -250).widths).toEqual({ a: 300, b: 300 });
    });
  });

  describe('G9: two-phase cascade', () => {
    it('shrinks every victim to min before anything collapses, the md example', () => {
      expect(resolve({ a: 350, b: 350, c: 500 }, 0, 200).widths).toEqual({ a: 550, b: 300, c: 350 });
    });

    it('then collapses nearest first', () => {
      expect(resolve({ a: 350, b: 350, c: 500 }, 0, 2000).widths).toEqual({ a: 1100, b: 50, c: 50 });
    });

    it('skips panels collapsed at the start, the md example', () => {
      expect(resolve({ a: 400, b: 50, c: 300, d: 350 }, 2, -2000).widths).toEqual({ a: 50, b: 50, c: 50, d: 950 });
    });

    it('leaves a non-collapsible victim at min', () => {
      const panels = [panel('a'), panel('b', { collapsible: false })];
      expect(resolveLayout(panels, dragOf({ a: 600, b: 400 }, 0), 2000).widths).toEqual({ a: 700, b: 300 });
    });
  });

  it('autoFill: a collapsed victim funds the grower, the md example', () => {
    expect(resolve({ a: 400, b: 300, c: 300 }, 0, 200).widths).toEqual({ a: 650, b: 50, c: 300 });
  });

  describe('G10: no swap', () => {
    it('opens the grower over budget when victims cannot fund it, the md example', () => {
      expect(resolve({ a: 443, b: 50 }, 0, -260).widths).toEqual({ a: 300, b: 300 });
    });

    it('lets the direct victim collapse once funded', () => {
      expect(resolve({ a: 700, b: 50 }, 0, -800).widths).toEqual({ a: 50, b: 700 });
    });
  });

  it('O2: overflow opens for free and victims only pay the rest, the md example', () => {
    expect(resolve({ a: 450, b: 500, c: 50 }, 1, -350, false).widths).toEqual({ a: 450, b: 400, c: 400 });
  });

  describe('invariants over random layouts', () => {
    let seed = 7;
    const random = (limit: number) => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed % limit;
    };
    const total = (widths: Record<string, number>) => Object.values(widths).reduce((sum, width) => sum + width, 0);

    it('never leaves a width between collapsed and min, and keeps the total unless a collapsed grower opens', () => {
      for (let run = 0; run < 20_000; run++) {
        const count = 2 + random(4);
        const widths = Object.fromEntries(Array.from({ length: count }, (_, i) => [`panel${i}`, random(3) === 0 ? 50 : 300 + random(5) * 50]));
        const separatorIndex = random(count - 1);
        const dx = (random(2) ? 1 : -1) * (1 + random(1500));
        const result = resolve(widths, separatorIndex, dx).widths;

        for (const width of Object.values(result)) expect(width === 50 || width >= 300).toBe(true);

        const growerId = `panel${dx < 0 ? separatorIndex + 1 : separatorIndex}`;
        if (widths[growerId] > 50) expect(total(result)).toBe(total(widths));
        else expect(total(result)).toBeGreaterThanOrEqual(total(widths));
      }
    });
  });
});
