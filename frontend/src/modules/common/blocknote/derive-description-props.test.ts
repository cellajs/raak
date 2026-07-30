import { describe, expect, it } from 'vitest';
import { deriveDescriptionCounts } from './derive-description-props';

const block = (type: string, props: Record<string, unknown> = {}, children: unknown[] = []) => ({
  id: crypto.randomUUID(),
  type,
  props,
  content: [],
  children,
});

describe('deriveDescriptionCounts', () => {
  it('counts checklist items including checked state', () => {
    const description = JSON.stringify([
      block('checklistItem', { checkboxId: 'a', checked: true }),
      block('checklistItem', { checkboxId: 'b', checked: false }),
      block('paragraph'),
    ]);
    expect(deriveDescriptionCounts(description)).toEqual({
      expandable: true,
      checkboxCount: 2,
      checkedCount: 1,
      attachments: [],
    });
  });

  it('counts nested children depth-first and collects attachment ids', () => {
    const description = JSON.stringify([
      block('paragraph', {}, [
        block('checklistItem', { checkboxId: 'a', checked: true }, [
          block('checklistItem', { checkboxId: 'b', checked: true }),
        ]),
        block('image', { url: 'https://x/img.png', attachmentId: 'att-1' }),
      ]),
    ]);
    expect(deriveDescriptionCounts(description)).toEqual({
      expandable: false,
      checkboxCount: 2,
      checkedCount: 2,
      attachments: ['att-1'],
    });
  });

  it('collects only media blocks with an attachment reference, unique in document order', () => {
    const description = JSON.stringify([
      block('image', { url: 'https://x/a.png', attachmentId: 'att-1' }),
      // External media URL without an attachment row contributes no id
      block('video', { url: 'https://x/clip.mp4' }),
      block('audio', {}),
      block('file', { url: 'https://x/b.pdf', attachmentId: 'att-2' }),
      // Duplicate reference stays unique
      block('image', { url: 'https://x/a.png', attachmentId: 'att-1' }),
    ]);
    expect(deriveDescriptionCounts(description)).toMatchObject({ attachments: ['att-1', 'att-2'], expandable: true });
  });

  it('returns zeroed counts for invalid JSON', () => {
    expect(deriveDescriptionCounts('not json')).toEqual({
      expandable: false,
      checkboxCount: 0,
      checkedCount: 0,
      attachments: [],
    });
  });
});
