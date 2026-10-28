import { describe, expect, it, vi } from 'vitest';

// The logo is a remote image: only that one load is replaced, so the test needs no network and draws on the real canvas.
vi.mock('@napi-rs/canvas', async (importOriginal) => {
  const canvas = await importOriginal<typeof import('@napi-rs/canvas')>();
  return {
    ...canvas,
    loadImage: (source: string) => (source.startsWith('https://') ? Promise.resolve(canvas.createCanvas(100, 80)) : canvas.loadImage(source)),
  };
});

const { generateCover } = await import('#/modules/task/helpers/canvas');

describe('Task cover', () => {
  it('draws a cover for an author without an avatar', async () => {
    const png = await generateCover({ title: 'Ship it', avatarUrl: '', name: 'Sync bot' });

    expect([...png.subarray(0, 4)]).toEqual([137, 80, 78, 71]);
  });
});
