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

  it('usa estructura header/main/footer en flujo para evitar overlays', () => {
    render(
      <GameRoundScaffold
        header={<div>header</div>}
        progress={<div>progreso</div>}
        question={question}
        questionNumber={1}
        totalQuestions={10}
        isMapQuestion
        mapContent={<div>mapa</div>}
        selectedAnswer={null}
        onOptionSelect={() => {}}
        showResult={false}
        actionTray={<div data-testid="tray">tray</div>}
      />
    );

    const layout = screen.getByText('header').closest('.universal-layout');
    const header = screen.getByTestId('universal-layout-header');
    const main = screen.getByTestId('universal-layout-main');
    const footer = screen.getByTestId('universal-layout-footer');

    expect(layout).toBeInTheDocument();
    expect(header).toContainElement(screen.getByText('progreso'));
    expect(main.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(footer).toContainElement(screen.getByTestId('tray'));
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
      expect(button.className).not.toContain('fixed');
    }
  });
});
