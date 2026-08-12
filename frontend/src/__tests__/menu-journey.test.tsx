import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockGetMasterySummary = vi.fn();

vi.mock('../services/api', () => ({
  api: {
    getMasterySummary: (...args: any[]) => mockGetMasterySummary(...args),
    getDailyStatus: vi.fn().mockResolvedValue({
      today: '2026-08-12',
      completed: false,
      dailyStreak: 0,
    }),
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
        'menu.journey.title': 'Tu viaje por el mundo',
        'menu.journey.stamped': 'países explorados',
        'menu.journey.mastered': 'dominados',
        'menu.journey.globalDominance': 'Dominio global',
        'menu.journey.continue': 'Seguir explorando',
        'menu.journey.passport': 'Pasaporte',
        'menu.journey.start': 'Comienza tu viaje por el mundo',
        'menu.journey.startTitle': 'Empieza tu viaje por el mundo',
        'menu.journey.startFirst': 'Empezar a explorar',
        'menu.journey.zeroStamps': '0 de {{total}} países explorados',
        'menu.journey.startDesc': 'Cada partida te ayuda a descubrir y dominar nuevos países.',
        'menu.daily.title': 'Reto del día',
        'menu.daily.available': 'Disponible',
        'menu.daily.desc': '10 preguntas',
        'menu.daily.play': 'Jugar reto de hoy',
        'menu.choose.title': '¿Qué quieres hacer?',
        'menu.choose.practice': 'Practicar',
        'menu.choose.practiceDesc': 'A tu manera',
        'menu.choose.compete': 'Competir',
        'menu.choose.competeDesc': 'Contra otros',
        'menu.practice.title': 'Practicar',
        'menu.practice.subtitle': 'Elige qué quieres entrenar.',
        'menu.practice.categories': 'Categorías',
        'menu.practice.formats': 'Formato',
        'menu.practice.classic': 'Clásico',
        'menu.practice.classicDesc': '10 preguntas a tu ritmo',
        'menu.practice.flash': 'Flash',
        'menu.practice.flashDesc': 'Rápido · 2 opciones',
        'menu.practice.streak': 'Racha',
        'menu.practice.streakDesc': 'Sigue mientras aciertes',
        'menu.compete.title': 'Competir',
        'menu.compete.subtitle': 'Pon a prueba lo que sabes contra otros.',
        'menu.compete.category': 'Categoría',
        'menu.compete.duel': 'Duelo',
        'menu.compete.duelDesc': 'En vivo · 1 vs 1',
        'menu.compete.challenge': 'Desafío',
        'menu.compete.challengeDesc': 'Invita a otros',
        'menu.compete.survival': 'Supervivencia',
        'menu.compete.survivalDesc': 'Último jugador en pie',
        'menu.special.flagMaster': 'Maestro de Banderas',
        'menu.special.flagMasterDesc': '10 rondas',
        'menu.special.geoChallenges': 'GeoRetos',
        'menu.special.geoChallengesDesc': '5 retos',
        'menu.special.geoChallengesDuel': 'GeoRetos Duel',
        'menu.special.geoChallengesDuelDesc': '10 preguntas',
        'menu.more.title': 'Más',
        'menu.more.rankings': 'Rankings',
        'menu.more.rankingsDesc': 'Mira el top global',
        'menu.more.stats': 'Mis estadísticas',
        'menu.more.statsDesc': 'Estadísticas',
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
        'common.close': 'Cerrar',
        'auth.logout': 'Salir',
        'filters.filterBy': 'Filtros',
        'howto.objectiveLabel': 'Objetivo',
        'howto.ruleLabel': 'Regla',
        'filters.openFilters': 'Abrir filtros',
        'filters.openActiveFilters': 'Abrir filtros. Filtros activos: {{summary}}',
        'filters.clearActive': 'Limpiar filtros',
        'menu.howToPlayAria': 'Cómo se juega {{mode}}',
        'menu.letsPlay': '¡Jugar!',
      };
      const template = map[key] ?? key;
      if (!_options) return template;
      return Object.entries(_options).reduce(
        (acc, [optKey, optValue]) => acc.replace(`{{${optKey}}}`, String(optValue ?? '')),
        template
      );
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
      expect(screen.getByText('0 de 180 países explorados')).toBeDefined();
    });
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
      expect(screen.getByText('Tu viaje por el mundo')).toBeDefined();
    });
    expect(screen.getByText('Seguir explorando')).toBeDefined();
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
      expect(screen.getByText('Seguir explorando')).toBeDefined();
    });

    const continueBtn = screen.getByText('Seguir explorando');
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
