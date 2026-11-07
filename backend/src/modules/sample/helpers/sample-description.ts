import { nanoid } from 'nanoid';
import { generateId } from 'shared/utils/entity-id';
import type { SampleTask } from '#/modules/sample/sample-content';

const inline = (text: string) => [{ type: 'text', text, styles: {} }];

// Props in the order the editor serializes them, so opening a sample task writes nothing back
const paragraph = (text: string) => ({
  id: generateId(),
  type: 'paragraph',
  props: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
  content: inline(text),
  children: [],
});

const checklistItem = (text: string, checked: boolean) => ({
  id: generateId(),
  type: 'checklistItem',
  props: { textColor: 'default', textAlignment: 'left', checkboxId: nanoid(12), checked },
  content: inline(text),
  children: [],
});

/** A sample task's stored description: its title as the first block, as the app writes one, then its paragraphs and todos. */
export const sampleDescription = ({ name, text, todos }: Pick<SampleTask, 'name' | 'text' | 'todos'>) =>
  JSON.stringify([paragraph(name), ...text.map(paragraph), ...todos.map((todo) => checklistItem(todo.text, todo.done))]);
