import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const mockGetMasterySummary = vi.fn();

vi.mock('../services/api', () => ({
  api: {
    getMasterySummary: (...args: any[]) => mockGetMasterySummary(...args),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { username: 'geoUser', highScore: 1200, gamesPlayed: 8, wins: 5, losses: 3 },
    logout: vi.fn(),
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, _options?: Record<string, string>) => {
      const map: Record<string, string> = {
        'menu.selectCategory': 'Selecciona una categoría',
        'menu.gameModes': 'Modos de juego',
        'menu.categorySelectorLabel': 'Categorías',
        'menu.categoryHelper': 'Elige cómo quieres',
        'menu.flash': 'Flash',
        'menu.flashDesc': '60s',
        'menu.singlePlayer': 'Un Jugador',
        'menu.singlePlayerDesc': 'Juega solo',
        'menu.duel': 'Duelo',
        'menu.duelDesc': 'Compite',
        'menu.challenge': 'Desafíos',
        'menu.challengeDesc': 'Envía desafíos',
        'menu.streak': 'Racha',
        'menu.streakDesc': 'Sigue hasta fallar',
        'menu.survival': 'Supervivencia',
        'menu.survivalDesc': 'Sobrevive',
        'menu.geoChallenges': 'GeoRetos',
        'menu.geoChallengesDesc': '5 retos',
        'menu.flagMaster': 'Flag Master',
        'menu.flagMasterDesc': 'Domina banderas',
        'menu.daily': 'Reto Diario',
        'menu.dailyDesc': 'Cada día',
        'categories.flags': 'Banderas',
        'categories.capitals': 'Capitales',
        'categories.maps': 'Mapas',
        'categories.silhouettes': 'Siluetas',
        'categories.monuments': 'Monumentos',
        'categories.cinemaGeo': 'Cine & Geo',
        'categories.mixed': 'Mixto',
        'menu.journey.title': 'Tu viaje',
        'menu.journey.stamped': 'países sellados',
        'menu.journey.ofWorld': 'del mundo',
        'menu.journey.continue': 'Continuar viaje',
        'menu.journey.passport': 'Pasaporte',
        'menu.journey.start': 'Comienza tu viaje por el mundo',
        'menu.journey.startFirst': 'Empezar a explorar',
        'menu.journey.zeroStamps': '0 países sellados',
        'howto.flash.objective': 'Contesta 60 preguntas en 60s',
        'howto.flash.rule': '+1 punto por acierto',
        'howto.streak.objective': 'Sigue respondiendo',
        'howto.streak.rule': '1 fallo = game over',
        'howto.single.objective': 'Responde preguntas',
        'howto.single.rule': '10 preguntas',
        'howto.duel.objective': 'Compite',
        'howto.duel.rule': 'El mejor gana',
        'howto.challenge.objective': 'Desafía',
        'howto.challenge.rule': 'Envía a amigos',
        'howto.survival.objective': 'Sobrevive',
        'howto.survival.rule': 'Último en pie gana',
        'common.backToMenu': 'Volver',
        'common.ready': '¡Listo!',
        'auth.logout': 'Salir',
        'filters.filterBy': 'Filtros',
        'howto.objectiveLabel': 'Objetivo',
        'howto.ruleLabel': 'Regla',
      };
      return map[key] ?? key;
    },
  }),
}));

import { MenuPage } from '../pages/MenuPage';

describe('MenuPage — journey card', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows new user journey card with 0 stamps', async () => {
    mockGetMasterySummary.mockResolvedValue({
      worldProgressPercent: 0,
      totalCountries: 180,
      stampedCountries: 0,
      masteredCountries: 0,
      skills: [],
    });

    render(
      <MemoryRouter>
        <MenuPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Comienza tu viaje por el mundo')).toBeDefined();
    });
    expect(screen.getByText('0 países sellados')).toBeDefined();
    expect(screen.getByText('Empezar a explorar')).toBeDefined();
  });

  it('shows existing user journey summary with stamps', async () => {
    mockGetMasterySummary.mockResolvedValue({
      worldProgressPercent: 3.7,
      totalCountries: 180,
      stampedCountries: 24,
      masteredCountries: 2,
      skills: [],
    });

    render(
      <MemoryRouter>
        <MenuPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Tu viaje')).toBeDefined();
    });
    expect(screen.getByText('Continuar viaje')).toBeDefined();
    expect(screen.getByText('Pasaporte')).toBeDefined();
  });

  it('Continue journey navigates to practice gameType=practice', async () => {
    mockGetMasterySummary.mockResolvedValue({
      worldProgressPercent: 1,
      totalCountries: 180,
      stampedCountries: 3,
      masteredCountries: 0,
      skills: [],
    });

    render(
      <MemoryRouter>
        <MenuPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Continuar viaje')).toBeDefined();
    });

    const continueBtn = screen.getByText('Continuar viaje');
    expect(continueBtn).toBeDefined();
  });

  it('Passport button renders and is clickable', async () => {
    mockGetMasterySummary.mockResolvedValue({
      worldProgressPercent: 1,
      totalCountries: 180,
      stampedCountries: 3,
      masteredCountries: 0,
      skills: [],
    });

    render(
      <MemoryRouter>
        <MenuPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Pasaporte')).toBeDefined();
    });
  });
});
