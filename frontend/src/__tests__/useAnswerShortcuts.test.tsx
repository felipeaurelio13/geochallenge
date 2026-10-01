import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAnswerShortcuts, type UseAnswerShortcutsOptions } from '../hooks/useAnswerShortcuts';

const OPTIONS = ['Santiago', 'Lima', 'Bogotá', 'Quito'];

function Harness(props: UseAnswerShortcutsOptions) {
  useAnswerShortcuts(props);
  return (
    <div>
      <input aria-label="field" />
      <textarea aria-label="notes" />
      <div aria-label="editable" contentEditable suppressContentEditableWarning />
      <button type="button">btn</button>
    </div>
  );
}

function setup(overrides: Partial<UseAnswerShortcutsOptions> = {}) {
  const handlers = { onSelect: vi.fn(), onSubmit: vi.fn(), onNext: vi.fn() };
  const props: UseAnswerShortcutsOptions = {
    options: OPTIONS,
    enabled: true,
    ...handlers,
    ...overrides,
  };
  const utils = render(<Harness {...props} />);
  return { ...handlers, props, ...utils };
}

describe('useAnswerShortcuts', () => {
  it('maps A-D and 1-4 to options', () => {
    const { onSelect } = setup();
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 'D' });
    fireEvent.keyDown(window, { key: '2' });
    fireEvent.keyDown(window, { key: '3' });
    expect(onSelect.mock.calls).toEqual([
      ['Santiago', 0],
      ['Quito', 3],
      ['Lima', 1],
      ['Bogotá', 2],
    ]);
  });

  it('ignores keys without a matching option', () => {
    const { onSelect } = setup({ options: ['Only', 'Two'] });
    fireEvent.keyDown(window, { key: 'c' });
    fireEvent.keyDown(window, { key: '4' });
    fireEvent.keyDown(window, { key: 'x' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('submits on Enter when allowed and not when canSubmit is false', () => {
    const first = setup();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(first.onSubmit).toHaveBeenCalledTimes(1);
    expect(first.onNext).not.toHaveBeenCalled();
    first.unmount();

    const second = setup({ canSubmit: false });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(second.onSubmit).not.toHaveBeenCalled();
  });

  it('advances with Enter or N once a result is shown, even with no options (map)', () => {
    const { onNext, onSubmit, onSelect } = setup({ showResult: true, options: [] });
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'n' });
    fireEvent.keyDown(window, { key: 'N' });
    expect(onNext).toHaveBeenCalledTimes(3);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not select or advance with N before a result, nor select after a result', () => {
    const before = setup();
    fireEvent.keyDown(window, { key: 'n' });
    expect(before.onNext).not.toHaveBeenCalled();
    before.unmount();

    const after = setup({ showResult: true });
    fireEvent.keyDown(window, { key: 'a' });
    expect(after.onSelect).not.toHaveBeenCalled();
  });

  it('ignores modifier combos and key repeat', () => {
    const { onSelect, onSubmit } = setup();
    fireEvent.keyDown(window, { key: 'd', metaKey: true });
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(window, { key: '1', altKey: true });
    fireEvent.keyDown(window, { key: 'a', repeat: true });
    fireEvent.keyDown(window, { key: 'Enter', repeat: true });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ignores events from inputs, textareas and contenteditable elements', () => {
    const { onSelect, onSubmit, getByLabelText } = setup();
    fireEvent.keyDown(getByLabelText('field'), { key: 'a' });
    fireEvent.keyDown(getByLabelText('field'), { key: 'Enter' });
    fireEvent.keyDown(getByLabelText('notes'), { key: 'b' });
    fireEvent.keyDown(getByLabelText('editable'), { key: 'c' });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not fire Enter on a focused button (native click handles it) but still allows letter keys', () => {
    const { onSelect, onSubmit, onNext, getByText, rerender, props } = setup();
    fireEvent.keyDown(getByText('btn'), { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(getByText('btn'), { key: 'b' });
    expect(onSelect).toHaveBeenCalledWith('Lima', 1);

    rerender(<Harness {...props} showResult />);
    fireEvent.keyDown(getByText('btn'), { key: 'Enter' });
    expect(onNext).not.toHaveBeenCalled();
  });

  it('does nothing while disabled and resumes when re-enabled', () => {
    const { onSelect, rerender, props } = setup({ enabled: false });
    fireEvent.keyDown(window, { key: 'a' });
    expect(onSelect).not.toHaveBeenCalled();

    rerender(<Harness {...props} enabled />);
    fireEvent.keyDown(window, { key: 'a' });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('always calls the latest handlers (no stale closures)', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, props } = setup({ onSubmit: first });

    rerender(<Harness {...props} onSubmit={second} />);
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('removes the listener on unmount', () => {
    const { onSelect, unmount } = setup();
    unmount();
    fireEvent.keyDown(window, { key: 'a' });
    expect(onSelect).not.toHaveBeenCalled();
  });
});
