import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GameRoundScaffold } from '../components/GameRoundScaffold';
import type { Question } from '../types';

const captured = vi.hoisted(() => ({ onClicks: [] as Array<Array<() => void>> }));

vi.mock('../components/QuestionCard', () => ({ QuestionCard: () => <div /> }));
vi.mock('../utils/monumentOptions', () => ({ getOptionDisplayLabel: (_q: unknown, option: string) => option }));
vi.mock('../components/OptionButton', () => ({
  OptionButton: ({ onClick, index }: { onClick: () => void; index: number }) => {
    (captured.onClicks[captured.onClicks.length - 1] ??= [])[index] = onClick;
    return <button onClick={onClick}>{index}</button>;
  },
}));

const question = {
  id: 'q1',
  category: 'CAPITAL',
  questionText: '?',
  options: ['A', 'B', 'C', 'D'],
} as unknown as Question;

function element(onOptionSelect: (o: string) => void) {
  return (
    <GameRoundScaffold
      header={<div />}
      question={question}
      questionNumber={1}
      totalQuestions={10}
      isMapQuestion={false}
      mapContent={null}
      selectedAnswer={null}
      onOptionSelect={onOptionSelect}
      showResult={false}
      actionTray={<div />}
    />
  );
}

describe('GameRoundScaffold option handlers', () => {
  it('keeps option onClick identity stable across re-renders and calls the latest onOptionSelect', () => {
    const first = vi.fn();
    const second = vi.fn();
    captured.onClicks = [[]];
    const { rerender, getAllByRole } = render(element(first));
    const initial = [...captured.onClicks[0]];

    captured.onClicks.push([]);
    rerender(element(second));

    expect(captured.onClicks[1]).toEqual(initial);
    expect(captured.onClicks[1].every((fn, i) => fn === initial[i])).toBe(true);

    getAllByRole('button')[2].click();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('C');
  });
});
