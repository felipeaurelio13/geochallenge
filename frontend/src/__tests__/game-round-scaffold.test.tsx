import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GameRoundScaffold } from '../components/GameRoundScaffold';
import type { Question } from '../types';

vi.mock('../components/QuestionCard', () => ({
  QuestionCard: () => <div data-testid="question-card">Question card</div>,
}));

vi.mock('../components/OptionButton', () => ({
  OptionButton: ({ option }: { option: string }) => <button type="button" className="option-row">{option}</button>,
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

  it('usa el layout universal sin scroll y evita compresión del enunciado', () => {
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

    const layout = screen.getByText('header').closest('.universal-layout');
    const questionCard = screen.getByTestId('question-card');

    expect(questionCard.parentElement).toHaveClass('shrink-0');
    expect(layout).toBeInTheDocument();
    expect(layout).toHaveClass('universal-layout');

    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: window.innerHeight });
    Object.defineProperty(document.documentElement, 'scrollWidth', { configurable: true, value: window.innerWidth });
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  it('centra verticalmente capitales y mantiene opciones en flujo sin overlay absoluto', () => {
    const capitalQuestion = {
      ...question,
      category: 'CAPITAL',
      options: ['Santiago', 'Lima', 'Bogotá', 'Quito'],
    } as Question;

    render(
      <GameRoundScaffold
        header={<div>header</div>}
        question={capitalQuestion}
        questionNumber={1}
        totalQuestions={10}
        isMapQuestion={false}
        mapContent={null}
        selectedAnswer={null}
        onOptionSelect={() => {}}
        showResult={true}
        actionTray={<div>tray</div>}
      />
    );

    expect(screen.getByTestId('question-card').parentElement).toHaveClass('flex-1');
    for (const button of screen.getAllByRole('button')) {
      expect(button.className).not.toContain('absolute');
    }
  });
});
