import { HistoryIcon, SearchIcon } from 'lucide-react';
import { type FocusEvent, type KeyboardEvent, type MouseEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { foldText, matchesTerms } from 'shared/utils/text-match';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useDebounce } from '~/hooks/use-debounce';
import { HighlightText } from '~/modules/common/match-highlight/highlight-text';
import { MatchScope } from '~/modules/common/match-highlight/match-scope';
import { SearchClearButton } from '~/modules/common/search-clear-button';
import { SearchSpinner } from '~/modules/common/search-spinner';
import { Chip } from '~/modules/ui/chip';
import { Combobox, ComboboxContent, ComboboxGroup, ComboboxItem, ComboboxList, ComboboxPrimitive, ComboboxSeparator } from '~/modules/ui/combobox';
import { InputGroup, InputGroupAddon, InputGroupInput } from '~/modules/ui/input-group';
import { Kbd } from '~/modules/ui/kbd';
import { cn } from '~/utils/cn';

export interface SearchChip {
  key: string;
  /** The filter this chip is a value of, and that value: pressing the chip offers the filter's other values. */
  group: string;
  value: string;
  label: string;
  icon?: ReactNode;
  onRemove: () => void;
}

export interface SearchOption {
  value: string;
  label: string;
  icon?: ReactNode;
  /** The items choosing this option would show. */
  count?: number;
  isSelected: boolean;
}

/** One filter of a list. Its values widen each other; different filters and the search words narrow. */
export interface SearchOptionGroup {
  key: string;
  /** Names the row for assistive technology; a row shows no heading. */
  label: string;
  options: SearchOption[];
  onToggle: (value: string) => void;
  /** Swaps a selected value for another. A filter of one value can leave this out: its toggle already does that. */
  onReplace?: (from: string, to: string) => void;
  /** Smaller chips, for a row of many values such as labels. */
  isCompact?: boolean;
  /** How many options the row shows; a selected one always shows, and typing finds the rest. */
  rowLimit?: number;
}

/** A search made before, with its filters. */
export interface SearchRecent {
  key: string;
  text: string;
  chips: Pick<SearchChip, 'label' | 'icon'>[];
  onPick: () => void;
  onRemove: () => void;
}

/** What a list offers beside its search words: the filters and their chips, and optionally its recent searches. */
export interface SearchFilters {
  groups: SearchOptionGroup[];
  chips: SearchChip[];
  recents?: SearchRecent[];
  /** The field closed on this search, to remember it. */
  onSearchEnd?: (q: string) => void;
}

interface SearchChipsFieldProps extends SearchFilters {
  /** The applied search words, such as the URL's `q`. */
  value: string;
  /** Receives the words once typing pauses, and at once when a chip goes. */
  onSearch: (value: string) => void;
  /** Clears the words and every filter. */
  onReset: () => void;
  /** Accessible name, and the placeholder. */
  label: string;
  name?: string;
  id?: string;
  disabled?: boolean;
  isSearching?: boolean;
  /** What the search finds, as "4 tasks"; empty while nothing narrows the list. */
  count?: string;
  className?: string;
}

type SearchSelection =
  | { kind: 'text' }
  | { kind: 'option'; group: SearchOptionGroup; option: SearchOption }
  | { kind: 'recent'; recent: SearchRecent };

const typingPause = 250;

const wordSeparators = /[\s,]+/;
const splitWords = (text: string) => text.split(wordSeparators).filter(Boolean);
const joinQuery = (words: string[], draft: string) => [...words, draft.trim()].filter(Boolean).join(' ');

const isComposing = (event: Event) => event instanceof InputEvent && event.isComposing;
const isTouch = () => window.matchMedia('(pointer: coarse)').matches;

// A touch device keeps the options on focus out: a chip's press lowers the keyboard, and the options stay to pick more
const closingReasons = new Set(['outside-press', 'escape-key', 'focus-out']);

const filterChipClass = 'border-transparent bg-foreground-soft text-background [&_button]:hover:bg-background/20 [&_button]:hover:text-background';
const pickingChipClass = 'outline-2 outline-foreground-soft outline-offset-1';
const editingChipClass = 'border-foreground-soft bg-background pr-0.5 pl-2.5';
const phoneChipClass = 'h-7 shrink-0 [&>button:last-child]:size-6';
// The width of the bar's close X and the gap before it, so the options on a phone reach as far as the bar's row
const phonePopupWidthClass = 'w-[calc(var(--anchor-width)+2.5rem)]';

/**
 * A search where every word and filter is its own chip with its own X. The input holds only the word being typed, which
 * filters as it is typed: a space, a comma, Enter or leaving the field turns it into a chip. An empty input offers every
 * filter and the recent searches, an input with text suggests what matches it. Pressing a chip's value changes it: a word
 * is edited in place, a filter's value offers the filter's other values to swap it for. From `sm` up the chips sit in the field and
 * its X clears the search, leaving open options open to close on the next press; on a phone the chips scroll in a row below
 * the field and the bar's X clears and closes.
 */
export function SearchChipsField({
  value,
  onSearch,
  onReset,
  label,
  name,
  id,
  disabled,
  isSearching = false,
  count = '',
  groups,
  chips,
  recents = [],
  onSearchEnd,
  className,
}: SearchChipsFieldProps) {
  const { t } = useTranslation();
  const isMobile = useBreakpointBelow('sm');
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const highlightedRef = useRef<SearchSelection | undefined>(undefined);
  const wordInputRef = useRef<HTMLInputElement>(null);

  const [words, setWords] = useState(() => splitWords(value));
  const [draft, setDraft] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [pickingKey, setPickingKey] = useState<string | null>(null);
  const [wordEdit, setWordEdit] = useState<{ word: string; text: string } | null>(null);

  // A chip can go from under its edit, such as by a reset, a recent search or the back button
  if (wordEdit && !words.includes(wordEdit.word)) setWordEdit(null);

  const editedWords = wordEdit ? [...new Set(words.flatMap((other) => (other === wordEdit.word ? splitWords(wordEdit.text) : [other])))] : words;
  const query = joinQuery(editedWords, draft);
  const typedQuery = useDebounce(query, typingPause);
  const sentRef = useRef(value);

  const send = (next: string) => {
    sentRef.current = next;
    onSearch(next);
  };

  useEffect(() => {
    if (typedQuery !== sentRef.current) send(typedQuery);
  }, [typedQuery]);

  // A change from outside, such as a reset, a recent search or the back button
  useEffect(() => {
    if (value === sentRef.current) return;
    sentRef.current = value;
    setWords(splitWords(value));
    setDraft('');
  }, [value]);

  const word = draft.trim();
  const isTyping = isOpen && !!word;
  const terms = word ? [foldText(word)] : [];
  const hasOptions = groups.length > 0 || recents.length > 0;
  const hasChips = chips.length > 0 || words.length > 0;
  const hasSearch = hasChips || !!word;

  const alternativesOf = (group?: SearchOptionGroup) => group?.options.filter((option) => !option.isSelected) ?? [];
  const groupOf = (chip?: SearchChip) => groups.find((group) => group.key === chip?.group);

  const pickingChip = chips.find((chip) => chip.key === pickingKey);
  const pickingGroup = groupOf(pickingChip);
  if (pickingKey && !pickingChip) setPickingKey(null);

  const close = () => {
    setPickingKey(null);
    setIsOpen(false);
    const nextWords = word && !words.includes(word) ? [...words, word] : words;
    setWords(nextWords);
    setDraft('');
    const next = joinQuery(nextWords, '');
    if (next !== sentRef.current) send(next);
    onSearchEnd?.(next);
  };

  const dropDraft = () => {
    setDraft('');
    send(joinQuery(words, ''));
  };

  // Flushed so the edit's input is gone before focus moves on: its blur would save the edit again
  const endWordEdit = (save: boolean) => {
    if (!wordEdit) return;
    flushSync(() => {
      if (save) setWords(editedWords);
      setWordEdit(null);
    });
  };

  const removeWord = (removed: string) => {
    const isEdited = wordEdit?.word === removed;
    const next = (isEdited ? words : editedWords).filter((other) => other !== removed);
    flushSync(() => {
      setWords(next);
      setWordEdit(null);
    });
    send(joinQuery(next, draft));
    if (isEdited) inputRef.current?.focus();
  };

  const clearOrClose = ({ currentTarget }: MouseEvent<HTMLButtonElement>) => {
    if (!hasSearch) {
      setIsOpen(false);
      return inputRef.current?.blur();
    }
    onSearchEnd?.(query);
    const wasEditing = !!wordEdit;
    endWordEdit(false);
    setWords([]);
    setDraft('');
    sentRef.current = '';
    onReset();
    // Only a keyboard gets the X focused, and clearing hides it; a mouse press leaves focus and the options as they are
    if (wasEditing || document.activeElement === currentTarget) inputRef.current?.focus();
  };

  const pressFilterChip = (chip: SearchChip) => {
    endWordEdit(true);
    setPickingKey(chip.key === pickingKey ? null : chip.key);
    if (hasOptions) setIsOpen(true);
    // In the input the arrow keys walk the options; a phone keeps its keyboard down for a choice between chips
    if (!isTouch()) inputRef.current?.focus();
  };

  const pressWordChip = (text: string) => {
    endWordEdit(true);
    setPickingKey(null);
    setIsOpen(false);
    // Rendered within the tap, so the input takes focus inside the gesture: iOS opens its keyboard for no later focus
    flushSync(() => setWordEdit({ word: text, text }));
    wordInputRef.current?.focus();
    wordInputRef.current?.select();
  };

  const handleWordKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' && event.key !== 'Escape') return;
    event.preventDefault();
    endWordEdit(event.key === 'Enter');
    if (!isTouch()) inputRef.current?.focus();
  };

  const handleWordBlur = ({ relatedTarget }: FocusEvent<HTMLInputElement>) => {
    endWordEdit(true);
    if (!fieldRef.current?.contains(relatedTarget)) onSearchEnd?.(query);
  };

  const pick = (selection: SearchSelection | null) => {
    if (!selection) return;
    if (selection.kind === 'text') return close();
    if (selection.kind === 'recent') {
      selection.recent.onPick();
      return setIsOpen(false);
    }
    if (pickingChip) {
      const { group, option } = selection;
      group.onReplace ? group.onReplace(pickingChip.value, option.value) : group.onToggle(option.value);
      setPickingKey(null);
      if (isTouch()) inputRef.current?.blur();
      return;
    }
    selection.group.onToggle(selection.option.value);
    // A suggestion replaces the word that found it; a chip leaves the options open to pick more
    if (isTyping) {
      dropDraft();
      setIsOpen(false);
    } else if (isTouch()) inputRef.current?.blur();
  };

  const handleInputChange = (next: string, event: Event) => {
    const parts = isComposing(event) ? [next] : next.split(wordSeparators);
    const finished = parts.slice(0, -1).filter((part) => part && !words.includes(part));
    if (finished.length) setWords([...words, ...finished]);
    setDraft(parts.at(-1) ?? '');
    setPickingKey(null);
    if (hasOptions) setIsOpen(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement> & { preventBaseUIHandler: () => void }) => {
    if (event.key === 'Enter' && !highlightedRef.current) {
      event.preventDefault();
      close();
      if (isTouch()) event.currentTarget.blur();
    } else if (event.key === 'Escape' && draft) {
      event.preventBaseUIHandler();
      dropDraft();
    } else if (event.key === 'Escape' && !isOpen) {
      event.currentTarget.blur();
    } else if (event.key === 'Backspace' && !draft) {
      // A keyword comes back to be edited; a filter just goes
      const lastWord = words.at(-1);
      if (lastWord) {
        // Else the key goes on to delete the word's last character
        event.preventDefault();
        setWords(words.slice(0, -1));
        setDraft(lastWord);
      } else chips.at(-1)?.onRemove();
    }
  };

  const chipNodes = (
    <>
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          onRemove={chip.onRemove}
          removeLabel={t('c:remove_resource', { resource: chip.label })}
          onPress={alternativesOf(groupOf(chip)).length > 0 ? () => pressFilterChip(chip) : undefined}
          pressLabel={t('c:change_resource', { resource: chip.label })}
          isExpanded={chip.key === pickingKey}
          className={cn('max-w-48', filterChipClass, isMobile && phoneChipClass, chip.key === pickingKey && pickingChipClass)}
        >
          <span className="flex items-center gap-1 [&_svg]:size-3.5 [&_svg]:shrink-0">
            {chip.icon}
            {chip.label}
          </span>
        </Chip>
      ))}
      {words.map((text) =>
        wordEdit?.word === text ? (
          <Chip
            key={text}
            onRemove={() => removeWord(text)}
            removeLabel={t('c:remove_resource', { resource: text })}
            className={cn('max-w-48', editingChipClass, isMobile && phoneChipClass)}
            // A press on its X leaves focus in the edit: losing it would save the edit, and its chip would go before the click lands
            onMouseDown={(event) => {
              if (event.target !== wordInputRef.current) event.preventDefault();
            }}
          >
            <input
              ref={wordInputRef}
              aria-label={t('c:edit_resource', { resource: text })}
              enterKeyHint="done"
              size={Math.max(wordEdit.text.length, 1)}
              value={wordEdit.text}
              onChange={(event) => setWordEdit({ word: text, text: event.target.value })}
              onKeyDown={handleWordKeyDown}
              onBlur={handleWordBlur}
              className="field-sizing-content min-w-2 max-w-full bg-transparent outline-hidden"
            />
          </Chip>
        ) : (
          <Chip
            key={text}
            onRemove={() => removeWord(text)}
            removeLabel={t('c:remove_resource', { resource: text })}
            onPress={() => pressWordChip(text)}
            pressLabel={t('c:edit_resource', { resource: text })}
            className={cn('max-w-48 *:data-[slot=chip-value]:cursor-text', isMobile && phoneChipClass)}
          >
            {text}
          </Chip>
        ),
      )}
    </>
  );

  const optionMatches = groups.flatMap((group) =>
    group.options.filter((option) => matchesTerms([foldText(option.label)], terms)).map((option) => ({ group, option })),
  );
  const recentMatches = recents
    .filter((recent) => matchesTerms([foldText(recent.text)], terms) && foldText(recent.text) !== foldText(word))
    .slice(0, 2);

  const groupRow = (group: SearchOptionGroup) => (
    <ComboboxGroup key={group.key} aria-label={group.label} className="no-scrollbar flex gap-1 overflow-x-auto border-b px-3 py-2 last:border-b-0">
      {group.options
        .filter((option, index) => group.rowLimit === undefined || index < group.rowLimit || option.isSelected)
        .map((option) => (
          <ComboboxItem
            key={option.value}
            value={{ kind: 'option', group, option } satisfies SearchSelection}
            aria-selected={option.isSelected}
            className={cn(
              'w-auto shrink-0 rounded-full border border-input px-2.5 py-0',
              group.isCompact ? 'h-6.5 pointer-coarse:h-8.5' : 'h-7.5 pointer-coarse:h-10',
              option.isSelected &&
                'border-transparent bg-foreground-soft text-background data-highlighted:bg-foreground-soft data-highlighted:text-background',
            )}
          >
            {option.icon}
            {option.label}
            {option.count !== undefined && (
              <span className={cn('text-xs tabular-nums', !option.isSelected && 'text-muted-foreground')}>{option.count}</span>
            )}
          </ComboboxItem>
        ))}
    </ComboboxGroup>
  );

  return (
    <div ref={fieldRef} className={cn('flex min-w-0 grow flex-col gap-1', className)}>
      <Combobox<SearchSelection>
        value={null}
        onValueChange={pick}
        inputValue={draft}
        onInputValueChange={(next, { reason, event }) => {
          // A pick writes the row's text into the input: only typing changes it
          if (reason === 'input-change') handleInputChange(next, event);
        }}
        open={isOpen && hasOptions}
        onOpenChange={(next, { reason }) => {
          if (next) setIsOpen(true);
          else if (reason === 'escape-key' && pickingChip) setPickingKey(null);
          else if (closingReasons.has(reason) && !(reason === 'focus-out' && isTouch())) close();
        }}
        onItemHighlighted={(item) => {
          highlightedRef.current = item;
        }}
        filter={() => true}
        itemToStringLabel={() => ''}
      >
        <ComboboxPrimitive.InputGroup
          ref={groupRef}
          render={<InputGroup className="h-auto min-h-10 flex-wrap" />}
          onClick={({ target }) => {
            if (target instanceof Element && !target.closest('button')) setPickingKey(null);
          }}
        >
          <InputGroupAddon className="pl-1.5">
            <SearchSpinner value={query} isSearching={isSearching} />
          </InputGroupAddon>

          {!isMobile && hasChips && <div className="flex flex-wrap items-center gap-1 py-1 pr-1">{chipNodes}</div>}

          <ComboboxPrimitive.Input
            ref={inputRef}
            render={<InputGroupInput className="min-w-24 pl-0!" />}
            id={id}
            name={name}
            disabled={disabled}
            placeholder={!isMobile && hasChips ? undefined : label}
            aria-label={label}
            enterKeyHint="search"
            onFocus={() => {
              if (hasOptions) setIsOpen(true);
            }}
            // A suggestion closes the options before focus leaves, so this ends that search
            onBlur={() => {
              if (!isOpen && !wordEdit) onSearchEnd?.(query);
            }}
            onKeyDown={handleKeyDown}
          />

          <InputGroupAddon className="gap-0.5 pr-1.5 has-[>button]:mr-0" align="inline-end">
            {/* Mounted while empty too: a status region announces changes only once it exists */}
            <span role="status" className="mr-1 whitespace-nowrap font-normal text-muted-foreground text-sm tabular-nums">
              {count}
            </span>
            {/* On a phone the bar's close X clears the search */}
            {!isMobile && (
              <SearchClearButton
                aria-label={hasSearch ? t('c:clear_search') : t('c:close')}
                className={cn(!hasSearch && !isOpen && 'invisible')}
                // Out of the tab order with nothing to clear: Tab closes the options, and that would hide the X it landed on
                tabIndex={hasSearch ? undefined : -1}
                onClick={clearOrClose}
              />
            )}
          </InputGroupAddon>
        </ComboboxPrimitive.InputGroup>

        <ComboboxContent
          anchor={isMobile ? fieldRef : groupRef}
          className={cn('min-w-80 max-w-(--available-width)', isMobile && phonePopupWidthClass)}
        >
          <ComboboxList className="p-0">
            {pickingChip && pickingGroup ? (
              <>
                <div aria-hidden className="px-3 pt-2 text-muted-foreground text-xs">
                  {t('c:change_resource_to', { resource: pickingChip.label })}
                </div>
                {groupRow({
                  ...pickingGroup,
                  label: t('c:change_resource_to', { resource: pickingChip.label }),
                  options: alternativesOf(pickingGroup),
                })}
              </>
            ) : isTyping ? (
              <div className="p-1">
                <ComboboxItem value={{ kind: 'text' } satisfies SearchSelection}>
                  <SearchIcon className="text-muted-foreground" />
                  <span className="truncate">{t('c:search_for', { query: word })}</span>
                  <Kbd className="ml-auto max-sm:hidden">Enter</Kbd>
                </ComboboxItem>
                <MatchScope terms={terms}>
                  {optionMatches.length > 0 && <ComboboxSeparator />}
                  {optionMatches.map(({ group, option }) => (
                    <ComboboxItem key={`${group.key}:${option.value}`} value={{ kind: 'option', group, option } satisfies SearchSelection}>
                      {option.icon}
                      <span className="truncate">
                        <HighlightText text={option.label} />
                      </span>
                      {option.count !== undefined && <span className="ml-auto text-muted-foreground text-xs tabular-nums">{option.count}</span>}
                    </ComboboxItem>
                  ))}
                  {recentMatches.length > 0 && <ComboboxSeparator />}
                  {recentMatches.map((recent) => (
                    <ComboboxItem key={recent.key} value={{ kind: 'recent', recent } satisfies SearchSelection}>
                      <HistoryIcon className="text-muted-foreground" />
                      <span className="truncate">
                        <HighlightText text={recent.text} />
                      </span>
                    </ComboboxItem>
                  ))}
                </MatchScope>
              </div>
            ) : (
              <>
                {recents.length > 0 && (
                  <ComboboxGroup aria-label={t('c:history')} className="border-b p-1 last:border-b-0">
                    {recents.map((recent) => (
                      <ComboboxItem key={recent.key} value={{ kind: 'recent', recent } satisfies SearchSelection} className="justify-between pr-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <HistoryIcon className="text-muted-foreground" />
                          {recent.chips.map((chip) => (
                            <Chip key={chip.label} className="shrink-0">
                              <span className="flex items-center gap-1 [&_svg]:size-3.5 [&_svg]:shrink-0">
                                {chip.icon}
                                {chip.label}
                              </span>
                            </Chip>
                          ))}
                          <span className="truncate">{recent.text}</span>
                        </div>
                        <SearchClearButton
                          aria-label={t('c:remove')}
                          // The margin puts this X under the field's
                          className="mr-px size-6 rounded-sm hover:bg-foreground/10 active:bg-foreground/10"
                          onClick={(event) => {
                            event.stopPropagation();
                            recent.onRemove();
                          }}
                        />
                      </ComboboxItem>
                    ))}
                  </ComboboxGroup>
                )}
                {groups.map(groupRow)}
              </>
            )}
          </ComboboxList>
        </ComboboxContent>

        {/* The part, so a press on a chip here counts as inside the field. The padding leaves room for a chip's outline */}
        {isMobile && hasChips && (
          <ComboboxPrimitive.Chips className="no-scrollbar -m-1 flex gap-1.5 overflow-x-auto p-1">{chipNodes}</ComboboxPrimitive.Chips>
        )}
      </Combobox>
    </div>
  );
}
