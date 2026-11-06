import { BlockNoteEditor } from '@blocknote/core';
import { blocksToYDoc } from '@blocknote/core/yjs';
import { useEffect, useState } from 'react';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { BlockNote, type CollaborationBundle } from '~/modules/common/blocknote/blocknote-editor';
import { customSchema } from '~/modules/common/blocknote/blocknote-schema';
import { exportTodos, exportTodosWhy, people } from '~/modules/marketing/about/demo/fixtures';
import { tw } from '~/utils/tw';

const fragmentName = 'highlight';
const editorClass = tw('w-full border-none bg-transparent');
const [doneTodo, typedTodo, nextTodo] = exportTodos;
const seedBlocks = [
  { type: 'paragraph' as const, content: exportTodosWhy },
  { type: 'checklistItem' as const, props: { checkboxId: 'hl-csv', checked: true }, content: doneTodo },
  { type: 'checklistItem' as const, props: { checkboxId: 'hl-pdf' }, content: typedTodo },
  { type: 'checklistItem' as const, props: { checkboxId: 'hl-mail' }, content: nextTodo },
];
// Each block holds one text node, in block order
const typedLine = seedBlocks.findIndex(({ content }) => content === typedTodo);
const collaborator = { name: people.sam.name, color: '#f9a8d4' };
const noop = () => {};

interface DocPair {
  local: Y.Doc;
  remote: Y.Doc;
  localAwareness: Awareness;
  remoteAwareness: Awareness;
}

/** Two documents synced in memory, as the relay would: the page's editor binds one, the scripted teammate writes the other. */
const createPair = (): DocPair => {
  const seed = BlockNoteEditor.create({ schema: customSchema });
  // Seeded written: an empty block has no text node for the teammate to write into
  const local = blocksToYDoc(seed, seedBlocks, fragmentName);
  const remote = new Y.Doc();
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(local));
  local.on('update', (update, origin) => origin !== remote && Y.applyUpdate(remote, update, local));
  remote.on('update', (update, origin) => origin !== local && Y.applyUpdate(local, update, remote));

  const localAwareness = new Awareness(local);
  const remoteAwareness = new Awareness(remote);
  remoteAwareness.on('update', ({ added, updated, removed }: Record<'added' | 'updated' | 'removed', number[]>) =>
    applyAwarenessUpdate(localAwareness, encodeAwarenessUpdate(remoteAwareness, [...added, ...updated, ...removed]), remote),
  );
  return { local, remote, localAwareness, remoteAwareness };
};

const textsOf = (fragment: Y.XmlFragment) => {
  const texts: Y.XmlText[] = [];
  const walk = (node: Y.XmlFragment | Y.XmlElement) => {
    for (const child of node.toArray()) {
      if (child instanceof Y.XmlText) texts.push(child);
      else if (child instanceof Y.XmlElement) walk(child);
    }
  };
  walk(fragment);
  return texts;
};

/**
 * BlockNote's own caret markup (its default renderCursor), held open: in 0.57 `showCursorLabels: 'always'` never sets the
 * `data-active` its stylesheet needs to show a label.
 */
const renderOpenCursor = (user: { name: string; color: string }) => {
  const style = `background-color: ${user.color}; color: black`;
  const base = document.createElement('span');
  base.classList.add('bn-collaboration-cursor__base');
  base.setAttribute('data-active', '');
  const caret = document.createElement('span');
  caret.setAttribute('contenteditable', 'false');
  caret.classList.add('bn-collaboration-cursor__caret');
  caret.setAttribute('style', style);
  const label = document.createElement('span');
  label.classList.add('bn-collaboration-cursor__label');
  label.setAttribute('style', style);
  label.textContent = user.name;
  caret.append(label);
  base.append('⁠', caret, '⁠');
  return base;
};

/** Rewrites the teammate's todo in the remote document to `typed` and puts the caret at its end. */
const writeRemote = ({ remote, remoteAwareness }: DocPair, typed: string) => {
  const line = textsOf(remote.getXmlFragment(fragmentName))[typedLine];
  if (!line) return;
  remote.transact(() => {
    if (line.length) line.delete(0, line.length);
    line.insert(0, typed);
  });
  const at = Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(line, line.length));
  remoteAwareness.setLocalStateField('cursor', { anchor: at, head: at });
};

/** Types the todo once each time `playing` turns on, and otherwise shows it written. */
const useTypedTodo = (playing: boolean) => {
  const [typed, setTyped] = useState<string>(typedTodo);

  useEffect(() => {
    if (!playing) {
      setTyped(typedTodo);
      return;
    }
    let length = 0;
    let interval = 0;
    setTyped('');
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => {
        length += 1;
        setTyped(typedTodo.slice(0, length));
        if (length >= typedTodo.length) window.clearInterval(interval);
      }, 70);
    }, 900);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [playing]);

  return typed;
};

/** The real description editor, bound to an in-memory document a scripted teammate writes a todo into, with BlockNote's own named caret. */
export function CoEdit({ playing }: { playing: boolean }) {
  const [pair, setPair] = useState<DocPair | null>(null);
  const typed = useTypedTodo(playing);

  // Made in an effect, so the cleanup that destroys the awarenesses always pairs with the mount that made them
  useEffect(() => {
    const created = createPair();
    created.remoteAwareness.setLocalStateField('user', collaborator);
    setPair(created);
    return () => {
      created.localAwareness.destroy();
      created.remoteAwareness.destroy();
    };
  }, []);

  useEffect(() => {
    if (pair) writeRemote(pair, typed);
  }, [pair, typed]);

  if (!pair) return <div className="h-36" />;

  const collaboration: CollaborationBundle & { showCursorLabels: 'always'; renderCursor: typeof renderOpenCursor } = {
    provider: { awareness: pair.localAwareness },
    fragment: pair.local.getXmlFragment(fragmentName),
    user: { name: 'Visitor', color: '#94a3b8' },
    showCursorLabels: 'always',
    renderCursor: renderOpenCursor,
  };

  return (
    <BlockNote
      id="highlight-co-edit"
      updateData={noop}
      collaboration={collaboration}
      editable={false}
      className={editorClass}
      dense
      trailingBlock={false}
      sideMenu={false}
      slashMenu={false}
      formattingToolbar={false}
      emojis={false}
    />
  );
}
