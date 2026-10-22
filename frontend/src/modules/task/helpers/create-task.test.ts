// @vitest-environment jsdom
import { generateId } from 'shared/utils/entity-id';
import { describe, expect, it } from 'vitest';
import { createTaskFormSchema, newTaskFormDefaults } from '~/modules/task/helpers/create-task';

const draft = (labels: object[], assignedTo: object[]) => ({
  ...newTaskFormDefaults,
  id: generateId(),
  projectId: generateId(),
  primaryLabelId: generateId(),
  labels,
  assignedTo,
});

describe('createTaskFormSchema', () => {
  // A draft keeps each picked row as it was saved, so a row from before a schema change lacks the newer fields
  it('accepts picked rows a draft saved before their schema changed', () => {
    const staleLabel = { id: generateId(), name: 'Bug', slug: 'bug' };
    const staleUser = { id: generateId(), name: 'Ada' };
    const result = createTaskFormSchema.safeParse(draft([staleLabel], [staleUser]));
    expect(result.success).toBe(true);
    expect(result.data?.labels).toEqual([staleLabel]);
    expect(result.data?.assignedTo).toEqual([staleUser]);
  });

  it('refuses a picked row without an id', () => {
    const result = createTaskFormSchema.safeParse(draft([{ name: 'Bug' }], []));
    expect(result.success).toBe(false);
    expect(result.error?.issues.map(({ path }) => path)).toEqual([['labels', 0]]);
  });
});
