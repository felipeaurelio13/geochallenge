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
      'geoChallenges.startJourney': 'Comenzar la vuelta al mundo',
      'geoChallenges.playDuel': 'Jugar duelo de 10 preguntas',
      'geoChallenges.confirm': 'Confirmar respuesta',
      'geoChallenges.correctOrder': 'Orden correcto',
      'geoChallenges.correctAnswer': 'Respuesta correcta',
      'geoChallenges.seeResults': 'Ver resultados',
      'geoChallenges.complete': '¡GeoReto completado!',
      'geoChallenges.completeDesc': 'Siete formas distintas de pensar el mundo.',
      'geoChallenges.passportComplete': 'Pasaporte geográfico completo',
      'geoChallenges.roundRecap': 'Repaso de la partida',
      'geoChallenges.performance.perfect': '¡Dominaste las cinco regiones del planeta!',
      'geoChallenges.playAgain': 'Jugar otra vez',
      'geoChallenges.share': 'Compartir GeoReto',
      'geoChallenges.resultPattern': 'Patrón de resultados',
      'geoChallenges.finishRetry': 'Reintentar',
      'geoChallenges.errorFinishing': 'No pudimos guardar tu resultado.',
      'geoChallenges.briefingBadge': 'Vuelta al mundo',
      'geoChallenges.briefingDesc': 'Una expedición geográfica corta',
      'geoChallenges.regionalCoverage': 'Cobertura geográfica de la partida',
      'geoChallenges.balancedRoute': 'Todas las macroregiones en cada partida',
      'geoChallenges.mechanicsPreview': 'Mecánicas de esta partida',
      'geoChallenges.briefingRules': '{{rounds}} retos · {{seconds}} segundos por reto',
      'geoChallenges.kinds.EXTREME': 'Extremos',
      'geoChallenges.kinds.HIGHER_LOWER': 'Mayor o menor',
      'geoChallenges.kinds.COMMON_NEIGHBOR': 'Vecino común',
      'geoChallenges.kinds.ODD_ONE_OUT': 'El intruso',
      'geoChallenges.kinds.NORTH_TO_SOUTH': 'Norte a sur',
      'geoChallenges.kinds.CAPITAL_PROXIMITY': 'Proximidad de capitales',
      'geoChallenges.kinds.ORDER_BY_METRIC': 'Ordenar por métrica',
      'geoChallenges.kinds.NEIGHBOR_COUNT': 'Conteo de fronteras',
      'geoChallenges.kinds.BORDER_CHAIN': 'Cadena de fronteras',
      'geoChallenges.regions.AFRICA': 'África',
      'geoChallenges.regions.AMERICAS': 'Américas',
      'geoChallenges.regions.ASIA': 'Asia',
      'geoChallenges.regions.EUROPE': 'Europa',
      'geoChallenges.regions.OCEANIA': 'Oceanía',
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
  region: GeoChallengeRound['region'] = 'AFRICA',
): GeoChallengeRound {
  return {
    id,
    kind,
    region,
    difficulty: 'MEDIUM',
    selectionMode,
    prompt: { es: `Pregunta ${id}`, en: `Question ${id}` },
    instruction: { es: `Instrucción ${id}`, en: `Instruction ${id}` },
    options: options.map(([optionId, label]) => ({
      id: optionId,
      label: { es: label, en: label },
    })),
  };
}

const game7: GeoChallengeStartResponse = {
  gameId: 'game-7',
  engineVersion: 'v2',
  sessionToken: 'signed-session-7',
  timePerRound: 25,
  dataVersion: 'v1',
  dataUpdatedAt: '2026-08-01',
  rounds: [
    round('r1', 'EXTREME', [['CL', 'Chile'], ['AR', 'Argentina']], 'single', 'AMERICAS'),
    round('r2', 'HIGHER_LOWER', [['BR', 'Brasil'], ['PE', 'Perú']], 'single', 'AMERICAS'),
    round('r3', 'CAPITAL_PROXIMITY', [['BO', 'Bolivia'], ['PY', 'Paraguay'], ['UY', 'Uruguay'], ['EC', 'Ecuador']], 'single', 'AFRICA'),
    round('r4', 'NEIGHBOR_COUNT', [['ZA', 'Sudáfrica'], ['NG', 'Nigeria'], ['KE', 'Kenia'], ['EG', 'Egipto']], 'single', 'ASIA'),
    round('r5', 'ORDER_BY_METRIC', [
      ['CA', 'Canadá'],
      ['US', 'Estados Unidos'],
      ['MX', 'México'],
      ['GT', 'Guatemala'],
    ], 'ordered', 'EUROPE'),
    round('r6', 'BORDER_CHAIN', [
      ['PT', 'Portugal'],
      ['ES', 'España'],
      ['FR', 'Francia'],
      ['BE', 'Bélgica'],
    ], 'ordered', 'OCEANIA'),
    round('r7', 'NORTH_TO_SOUTH', [
      ['NZ', 'Nueva Zelanda'],
      ['AU', 'Australia'],
      ['FJ', 'Fiyi'],
      ['PG', 'Papúa'],
    ], 'ordered', 'AFRICA'),
  ],
};

const correctByRound7: Record<string, string[]> = {
  r1: ['CL'],
  r2: ['BR'],
  r3: ['BO'],
  r4: ['ZA'],
  r5: ['CA', 'US', 'MX', 'GT'],
  r6: ['PT', 'ES', 'FR', 'BE'],
  r7: ['NZ', 'AU', 'FJ', 'PG'],
};

async function playThroughGame() {
  for (let i = 0; i < 7; i += 1) {
    const roundId = `r${i + 1}`;
    const correctIds = correctByRound7[roundId];
    if (correctIds.length === 1) {
      const optLabel = game7.rounds[i].options.find((o) => o.id === correctIds[0])?.label.es;
      if (optLabel) fireEvent.click(await screen.findByRole('button', { name: optLabel }));
    } else {
      for (const optId of correctIds) {
        const optLabel = game7.rounds[i].options.find((o) => o.id === optId)?.label.es;
        if (optLabel) fireEvent.click(await screen.findByRole('button', { name: optLabel }));
      }
    }
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar respuesta' }));
    if (i < 6) {
      fireEvent.click(await screen.findByRole('button', { name: 'Siguiente' }));
    } else {
      fireEvent.click(await screen.findByRole('button', { name: 'Ver resultados' }));
    }
  }
}

describe('GeoChallengesPage V2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.start.mockResolvedValue(game7);
    mocks.answer.mockImplementation(({ roundId, selectedOptionIds }) => ({
      roundId,
      isCorrect: JSON.stringify(selectedOptionIds) === JSON.stringify(correctByRound7[roundId]),
      correctOptionIds: correctByRound7[roundId],
      explanation: { es: `Explicación ${roundId}`, en: `Explanation ${roundId}` },
      points: 125,
    }));
    mocks.finish.mockImplementation(({ answers }) => ({
      gameId: game7.gameId,
      correctCount: answers.length,
      totalRounds: 7,
      totalScore: answers.length * 125,
      details: answers.map(({ roundId }: { roundId: string }) => ({ roundId, isCorrect: true })),
    }));
  });

  it('briefing con 7 rounds no asume 5', async () => {
    render(<GeoChallengesPage />);

    const briefingRules = await screen.findByText(/7 retos/);
    expect(briefingRules).toBeInTheDocument();

    const startButton = screen.getByRole('button', { name: 'Comenzar la vuelta al mundo' });
    expect(startButton).toBeInTheDocument();
  });

  it('cuatro kinds nuevos renderizan en el briefing', async () => {
    render(<GeoChallengesPage />);

    expect(await screen.findByText('Proximidad de capitales')).toBeInTheDocument();
    expect(screen.getByText('Conteo de fronteras')).toBeInTheDocument();
    expect(screen.getByText('Ordenar por métrica')).toBeInTheDocument();
    expect(screen.getByText('Cadena de fronteras')).toBeInTheDocument();
  });

  it('ORDER_BY_METRIC usa selección ordered: exige todas las opciones', async () => {
    render(<GeoChallengesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Comenzar la vuelta al mundo' }));

    await playThroughGame();

    expect(await screen.findByRole('heading', { name: '¡GeoReto completado!' })).toBeInTheDocument();
    expect(screen.getByText('7/7')).toBeInTheDocument();
  });

  it('ronda single incorrecta muestra "respuesta correcta" y NO "orden correcto"', async () => {
    render(<GeoChallengesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Comenzar la vuelta al mundo' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Argentina' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar respuesta' }));

    expect(await screen.findByText(/Respuesta correcta/)).toBeInTheDocument();
    expect(screen.queryByText(/Orden correcto/)).not.toBeInTheDocument();
  });

  it('finish failure NO entra a pantalla finished y NO fabrica score local', async () => {
    mocks.finish.mockRejectedValueOnce(new Error('Network error'));

    render(<GeoChallengesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Comenzar la vuelta al mundo' }));

    await playThroughGame();

    await waitFor(() => {
      expect(screen.getByText(/No pudimos guardar tu resultado/)).toBeInTheDocument();
    });

    expect(screen.queryByRole('heading', { name: '¡GeoReto completado!' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('retry de finish exitoso llama nuevamente finish y entra a results', async () => {
    mocks.finish.mockRejectedValueOnce(new Error('Network error'));
    mocks.finish.mockResolvedValueOnce({
      gameId: game7.gameId,
      correctCount: 7,
      totalRounds: 7,
      totalScore: 875,
      details: game7.rounds.map((r) => ({ roundId: r.id, isCorrect: true })),
    });

    render(<GeoChallengesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Comenzar la vuelta al mundo' }));

    await playThroughGame();

    await waitFor(() => {
      expect(screen.getByText(/No pudimos guardar tu resultado/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '¡GeoReto completado!' })).toBeInTheDocument();
    });
    expect(mocks.finish).toHaveBeenCalledTimes(2);
  });

  it('results soporta 7 rounds', async () => {
    render(<GeoChallengesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Comenzar la vuelta al mundo' }));

    await playThroughGame();

    expect(await screen.findByRole('heading', { name: '¡GeoReto completado!' })).toBeInTheDocument();
    expect(screen.getByText('7/7')).toBeInTheDocument();
  });

  it('cobertura geográfica muestra 5/5 derivado de regiones únicas', async () => {
    render(<GeoChallengesPage />);

    expect(await screen.findByText(/5\/5/)).toBeInTheDocument();
    expect(screen.getByText(/Todas las macroregiones/)).toBeInTheDocument();
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
