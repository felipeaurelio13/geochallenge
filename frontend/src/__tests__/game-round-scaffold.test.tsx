import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GameRoundScaffold } from '../components/GameRoundScaffold';
import type { Question } from '../types';

vi.mock('../components/QuestionCard', () => ({
  QuestionCard: () => <div data-testid="question-card">Question card</div>,
}));

vi.mock('../utils/monumentOptions', () => ({
  getOptionDisplayLabel: (_question: Question, option: string) => `localized-${option}`,
}));

vi.mock('../components/OptionButton', () => ({
  OptionButton: ({ option, displayLabel, isCorrect, selected, showResult }: {
    option: string;
    displayLabel?: string;
    isCorrect?: boolean;
    selected: boolean;
    showResult: boolean;
  }) => (
    <button
      type="button"
      className="option-row"
      data-correct={isCorrect ? 'true' : 'false'}
      data-selected={selected ? 'true' : 'false'}
      data-show-result={showResult ? 'true' : 'false'}
    >
      {displayLabel ?? option}
    </button>
  ),
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


  it('en preguntas con media mantiene bloque de opciones expandible para mostrar las 4 alternativas', () => {
    const flagQuestion = {
      ...question,
      category: 'FLAG',
      imageUrl: 'https://flagcdn.com/w320/ar.png',
      options: ['Argentina', 'Uruguay', 'Chile', 'Paraguay'],
      correctAnswer: 'Argentina',
    } as Question;

    render(
      <GameRoundScaffold
        header={<div>header</div>}
        question={flagQuestion}
        questionNumber={1}
        totalQuestions={10}
        isMapQuestion={false}
        mapContent={null}
        selectedAnswer={null}
        onOptionSelect={() => {}}
        showResult={false}
        actionTray={<div>tray</div>}
      />
    );

    const questionWrap = screen.getByTestId('question-card').parentElement;
    expect(questionWrap).toHaveClass('game-question-wrap--media');

    const optionsWrapper = screen.getByRole('button', { name: 'localized-Argentina' }).closest('.game-options-wrap');
    expect(optionsWrapper).toHaveClass('flex-1');
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });
  it('ancla capitales cerca del top y mantiene opciones en flujo sin overlay absoluto', () => {
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

    // Tras QA round 2 (ROUND2-005), CAPITAL ya no se centra verticalmente.
    // El wrapper se ancla arriba (items-start pt-2) para que las opciones
    // queden a tiro de pulgar en mobile sin ~150px de dead space.
    expect(screen.getByTestId('question-card').parentElement).toHaveClass('items-start');
    for (const button of screen.getAllByRole('button')) {
      expect(button.className).not.toContain('absolute');
      expect(button.className).not.toContain('fixed');
    }

    const optionsWrapper = screen.getByRole('button', { name: 'localized-Santiago' }).closest('.game-options-wrap');
    expect(optionsWrapper?.className).toContain('overflow-hidden');
  });

  it('marca en verde y con resultado correcto la alternativa seleccionada cuando coincide con el valor raw', () => {
    const localizedQuestion = {
      ...question,
      category: 'CAPITAL',
      options: ['raw-santiago', 'raw-lima', 'raw-bogota', 'raw-quito'],
    } as Question;

    render(
      <GameRoundScaffold
        header={<div>header</div>}
        question={localizedQuestion}
        questionNumber={1}
        totalQuestions={10}
        isMapQuestion={false}
        mapContent={null}
        selectedAnswer="raw-santiago"
        correctAnswer="raw-santiago"
        onOptionSelect={() => {}}
        showResult
        actionTray={<div>tray</div>}
      />
    );

    const selected = screen.getByRole('button', { name: 'localized-raw-santiago' });
    expect(selected).toHaveAttribute('data-selected', 'true');
    expect(selected).toHaveAttribute('data-correct', 'true');
    for (const button of screen.getAllByRole('button').filter((button) => button !== selected)) {
      expect(button).toHaveAttribute('data-correct', 'false');
    }
  });

  it('marca la alternativa correcta aunque no sea la seleccionada y mantiene el error como incorrecto', () => {
    const localizedQuestion = {
      ...question,
      category: 'CAPITAL',
      options: ['raw-santiago', 'raw-lima', 'raw-bogota', 'raw-quito'],
    } as Question;

    render(
      <GameRoundScaffold
        header={<div>header</div>}
        question={localizedQuestion}
        questionNumber={1}
        totalQuestions={10}
        isMapQuestion={false}
        mapContent={null}
        selectedAnswer="raw-lima"
        correctAnswer="raw-santiago"
        onOptionSelect={() => {}}
        showResult
        actionTray={<div>tray</div>}
      />
    );

    expect(screen.getByRole('button', { name: 'localized-raw-lima' })).toHaveAttribute('data-selected', 'true');
    expect(screen.getByRole('button', { name: 'localized-raw-lima' })).toHaveAttribute('data-correct', 'false');
    expect(screen.getByRole('button', { name: 'localized-raw-santiago' })).toHaveAttribute('data-correct', 'true');
    expect(screen.getByRole('button', { name: 'localized-raw-bogota' })).toHaveAttribute('data-correct', 'false');
    expect(screen.getByRole('button', { name: 'localized-raw-quito' })).toHaveAttribute('data-correct', 'false');
  });
});
