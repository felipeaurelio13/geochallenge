import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { GeoChallengeRound, GeoChallengeStartResponse } from '../types';
import {
  GeoChallengesPage,
  localizeGeoText,
  updateOrderedSelection,
} from '../pages/GeoChallengesPage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  start: vi.fn(),
  answer: vi.fn(),
  finish: vi.fn(),
  translate: (key: string, options?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      'common.loading': 'Cargando...',
      'common.backToMenu': 'Volver al menú',
      'common.skipToAnswerOptions': 'Saltar a las opciones',
      'geoChallenges.title': 'GeoRetos',
      'geoChallenges.preparing': 'Preparando...',
      'geoChallenges.confirm': 'Confirmar respuesta',
      'geoChallenges.correctOrder': 'Respuesta correcta',
      'geoChallenges.seeResults': 'Ver resultados',
      'geoChallenges.complete': '¡GeoReto completado!',
      'geoChallenges.completeDesc': 'Cinco formas distintas de pensar el mundo.',
      'geoChallenges.playAgain': 'Jugar otra vez',
      'geoChallenges.share': 'Compartir GeoReto',
      'geoChallenges.resultPattern': 'Patrón de resultados',
      'game.correct': 'Correcto',
      'game.incorrect': 'Incorrecto',
      'game.next': 'Siguiente',
      'game.exit': 'Salir',
      'game.confirmExit': '¿Salir?',
      'game.timeRemaining': '{{seconds}} segundos',
    };
    let value = translations[key] ?? key;
    for (const [optionKey, optionValue] of Object.entries(options ?? {})) {
      value = value.replace(`{{${optionKey}}}`, String(optionValue));
    }
    return value;
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'es' },
    t: mocks.translate,
  }),
}));

vi.mock('../services/api', () => {
  class ApiError extends Error {
    code?: string;
  }
  return {
    ApiError,
    api: {
      startGeoChallenges: mocks.start,
      submitGeoChallengeAnswer: mocks.answer,
      finishGeoChallenges: mocks.finish,
    },
  };
});

function round(
  id: string,
  kind: GeoChallengeRound['kind'],
  options: Array<[string, string]>,
  selectionMode: GeoChallengeRound['selectionMode'] = 'single',
): GeoChallengeRound {
  return {
    id,
    kind,
    selectionMode,
    prompt: { es: `Pregunta ${id}`, en: `Question ${id}` },
    instruction: { es: `Instrucción ${id}`, en: `Instruction ${id}` },
    options: options.map(([optionId, label]) => ({
      id: optionId,
      label: { es: label, en: label },
    })),
  };
}

const game: GeoChallengeStartResponse = {
  gameId: 'game-1',
  sessionToken: 'signed-session',
  timePerRound: 300,
  dataVersion: 'v1',
  dataUpdatedAt: '2026-08-01',
  rounds: [
    round('r1', 'EXTREME', [['CL', 'Chile'], ['AR', 'Argentina']]),
    round('r2', 'HIGHER_LOWER', [['BR', 'Brasil'], ['PE', 'Perú']]),
    round('r3', 'COMMON_NEIGHBOR', [['BO', 'Bolivia'], ['PY', 'Paraguay']]),
    round('r4', 'ODD_ONE_OUT', [['UY', 'Uruguay'], ['EC', 'Ecuador']]),
    round('r5', 'NORTH_TO_SOUTH', [
      ['CA', 'Canadá'],
      ['US', 'Estados Unidos'],
      ['MX', 'México'],
      ['GT', 'Guatemala'],
    ], 'ordered'),
  ],
};

const correctByRound: Record<string, string[]> = {
  r1: ['CL'],
  r2: ['BR'],
  r3: ['BO'],
  r4: ['UY'],
  r5: ['CA', 'US', 'MX', 'GT'],
};

describe('GeoChallengesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.start.mockResolvedValue(game);
    mocks.answer.mockImplementation(({ roundId, selectedOptionIds }) => ({
      roundId,
      isCorrect: JSON.stringify(selectedOptionIds) === JSON.stringify(correctByRound[roundId]),
      correctOptionIds: correctByRound[roundId],
      explanation: { es: `Explicación ${roundId}`, en: `Explanation ${roundId}` },
      points: 100,
    }));
    mocks.finish.mockImplementation(({ answers }) => ({
      gameId: game.gameId,
      correctCount: 5,
      totalRounds: 5,
      totalScore: 500,
      details: answers.map(({ roundId }: { roundId: string }) => ({ roundId, isCorrect: true })),
    }));
  });

  it('completes all five mechanics and preserves the ordered final answer', async () => {
    render(<GeoChallengesPage />);

    for (const [choice, next] of [
      ['Chile', 'Siguiente'],
      ['Brasil', 'Siguiente'],
      ['Bolivia', 'Siguiente'],
      ['Uruguay', 'Siguiente'],
    ]) {
      fireEvent.click(await screen.findByRole('button', { name: choice }));
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar respuesta' }));
      expect(await screen.findByText(/Correcto/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: next }));
    }

    for (const country of ['Canadá', 'Estados Unidos', 'México', 'Guatemala']) {
      fireEvent.click(await screen.findByRole('button', { name: country }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar respuesta' }));
    expect(await screen.findByText(/Correcto/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver resultados' }));

    expect(await screen.findByRole('heading', { name: '¡GeoReto completado!' })).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.finish).toHaveBeenCalledWith({
        sessionToken: 'signed-session',
        answers: [
          { roundId: 'r1', selectedOptionIds: ['CL'] },
          { roundId: 'r2', selectedOptionIds: ['BR'] },
          { roundId: 'r3', selectedOptionIds: ['BO'] },
          { roundId: 'r4', selectedOptionIds: ['UY'] },
          { roundId: 'r5', selectedOptionIds: ['CA', 'US', 'MX', 'GT'] },
        ],
      });
    });
  });

  it('adds and removes ordered choices without changing the remaining order', () => {
    expect(updateOrderedSelection([], 'CL')).toEqual(['CL']);
    expect(updateOrderedSelection(['CL'], 'AR')).toEqual(['CL', 'AR']);
    expect(updateOrderedSelection(['CL', 'AR', 'PE'], 'AR')).toEqual(['CL', 'PE']);
  });

  it('selects copy according to the active locale', () => {
    const copy = { es: 'Sur', en: 'South' };
    expect(localizeGeoText(copy, 'es-CL')).toBe('Sur');
    expect(localizeGeoText(copy, 'en-US')).toBe('South');
  });
});
