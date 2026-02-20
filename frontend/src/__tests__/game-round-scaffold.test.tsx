import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GameRoundScaffold } from '../components/GameRoundScaffold';
import type { Question } from '../types';

vi.mock('../components/QuestionCard', () => ({
  QuestionCard: () => <div data-testid="question-card">Question card</div>,
}));

vi.mock('../components/OptionButton', () => ({
  OptionButton: ({ option }: { option: string }) => <button type="button">{option}</button>,
}));

describe('GameRoundScaffold', () => {
  const question: Question = {
    id: 'q-map',
    category: 'MAP',
    questionText: '¿Dónde está Reykjavík?',
    questionData: 'Reykjavík',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'A',
    difficulty: 'MEDIUM',
  } as Question;

  it('evita que el bloque de enunciado se comprima en mobile', () => {
    render(
      <GameRoundScaffold
        header={<div>header</div>}
        question={question}
        questionNumber={1}
        totalQuestions={10}
        isMapQuestion
        mapContent={<div>mapa</div>}
        selectedAnswer={null}
        onOptionSelect={() => {}}
        showResult={false}
        actionTray={<div>tray</div>}
      />
    );

    const questionCard = screen.getByTestId('question-card');
    expect(questionCard.parentElement).toHaveClass('shrink-0');
  });
});
