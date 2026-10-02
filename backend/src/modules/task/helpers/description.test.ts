import { deriveDocument } from 'shared/utils/derive-description-core';
import { describe, expect, it } from 'vitest';
import { deriveDescriptionProps } from '#/modules/task/helpers/description';

const attachmentId = '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2c';

const text = (value: string) => ({ type: 'text', text: value, styles: {} });
const paragraph = (id: string, value: string) => ({ id, type: 'paragraph', props: {}, content: value ? [text(value)] : [], children: [] });
const checklistItem = (id: string, value: string, checked: boolean) => ({
  id,
  type: 'checklistItem',
  props: { checkboxId: `cb-${id}`, checked },
  content: [text(value)],
  children: [],
});
const image = (id: string, ref: string) => ({ id, type: 'image', props: { url: ref, attachmentId: ref }, content: [], children: [] });

describe('deriveDescriptionProps', () => {
  it('stores the summary and counts the client derivation patches into the cache', () => {
    const description = JSON.stringify([
      checklistItem('1', 'Buy milk', true),
      paragraph('2', ''),
      paragraph('3', 'Summary text'),
      checklistItem('4', 'Call back', false),
      image('5', attachmentId),
    ]);
    const shared = deriveDocument(description);

    const derived = deriveDescriptionProps(description);

    expect(derived).toMatchObject({
      summary: shared.summary,
      summaryLength: 'Summary text'.length,
      expandable: true,
      checkboxCount: 2,
      checkedCount: 1,
      attachments: [attachmentId],
    });
    expect(JSON.parse(derived.summary)).toEqual([paragraph('3', 'Summary text')]);
  });

  it('keeps only UUID-shaped attachment references', () => {
    const description = JSON.stringify([paragraph('1', 'Pictures'), image('2', 'not-a-uuid'), image('3', attachmentId)]);

    expect(deriveDescriptionProps(description).attachments).toEqual([attachmentId]);
  });

  it('indexes every distinct word for server search, past the shared derivation’s 900-character cap', () => {
    const words = Array.from({ length: 300 }, (_, index) => `word${index}`);
    const description = JSON.stringify([paragraph('1', words.join(' '))]);

    const { keywords } = deriveDescriptionProps(description);

    expect(keywords.split(' ')).toContain('word299');
    expect(deriveDocument(description).keywords).not.toContain('word299');
  });

  it('derives empty columns from a cleared or malformed description instead of throwing', () => {
    for (const description of [null, '', '<p>old html</p>', '{"not":"blocks"}']) {
      expect(deriveDescriptionProps(description)).toEqual({
        summary: '',
        summaryLength: 0,
        expandable: false,
        checkboxCount: 0,
        checkedCount: 0,
        attachments: [],
        keywords: '',
      });
    }
  });
});
