import { useEffect, useRef } from 'react';

export interface UseAnswerShortcutsOptions {
  /** Answer options mapped to keys 1-4 / A-D. Pass an empty array for map questions. */
  options: readonly string[];
  /** Called with the option and its index when a selection key is pressed. */
  onSelect: (option: string, index: number) => void;
  /** Enter before a result is shown (only when `canSubmit`). */
  onSubmit: () => void;
  /** Enter or N once a result is shown. */
  onNext: () => void;
  /** Master switch, e.g. `false` while a confirm dialog is open or no question is loaded. */
  enabled: boolean;
  /** When true the shortcuts advance (Enter/N) instead of selecting/submitting. */
  showResult?: boolean;
  /** Whether Enter may submit (an answer or map location is selected). Defaults to true. */
  canSubmit?: boolean;
}

const SELECT_KEYS: Record<string, number> = {
  '1': 0,
  '2': 1,
  '3': 2,
  '4': 3,
  a: 0,
  b: 1,
  c: 2,
  d: 3,
};

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  const editable = target.getAttribute('contenteditable');
  return editable !== null && editable.toLowerCase() !== 'false';
}

// Enter on a focused control already activates it natively; handling it here too
// would double-fire (e.g. Enter on "Exit" must not also submit the answer).
function isActivatableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'BUTTON' ||
    target.tagName === 'A' ||
    target.getAttribute('role') === 'button'
  );
}

export function useAnswerShortcuts({
  options,
  onSelect,
  onSubmit,
  onNext,
  enabled,
  showResult = false,
  canSubmit = true,
}: UseAnswerShortcutsOptions): void {
  const latest = useRef({ options, onSelect, onSubmit, onNext, showResult, canSubmit });
  latest.current = { options, onSelect, onSubmit, onNext, showResult, canSubmit };

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // A component that already consumed the key (e.g. the map drops a pin on
      // Enter and calls preventDefault) must not also trigger submit/next here.
      if (e.defaultPrevented) return;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTextEntryTarget(e.target)) return;

      const { options, onSelect, onSubmit, onNext, showResult, canSubmit } = latest.current;
      const key = e.key.toLowerCase();

      if (key === 'enter') {
        if (isActivatableTarget(e.target)) return;
        if (showResult) {
          e.preventDefault();
          onNext();
        } else if (canSubmit) {
          e.preventDefault();
          onSubmit();
        }
        return;
      }

      if (showResult) {
        if (key === 'n') onNext();
        return;
      }

      const index = SELECT_KEYS[key];
      if (index !== undefined && index < options.length) {
        onSelect(options[index], index);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}
