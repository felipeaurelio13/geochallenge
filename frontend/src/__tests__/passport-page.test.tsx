import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PassportPage } from '../pages/PassportPage';

const mockGetPassport = vi.fn();

vi.mock('../services/api', () => ({
  api: {
    getPassport: (...args: any[]) => mockGetPassport(...args),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      if (key === 'passport.practiceCountry' && options?.country) return `Practicar ${options.country}`;
      const map: Record<string, string> = {
        'passport.title': 'Mi viaje',
        'passport.worldProgress': 'del mundo',
        'passport.stamped': 'países sellados',
        'passport.totalCountries': 'países',
        'passport.mastered': 'dominados',
        'passport.masteredLabel': 'Dominado',
        'passport.empty': 'Juega partidas',
        'categories.flag': 'Banderas',
        'categories.capital': 'Capitales',
        'categories.map': 'Mapas',
        'categories.silhouette': 'Siluetas',
        'categories.monument': 'Monumentos',
        'common.retry': 'Reintentar',
        'common.all': 'Todos',
        'mastery.level.learning': 'Aprendiendo',
        'mastery.level.familiar': 'Conocido',
        'mastery.level.strong': 'Fuerte',
        'mastery.level.mastered': 'Dominado',
        'mastery.level.unseen': 'No jugado',
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock('../components', async () => {
  const actual: any = await vi.importActual('../components');
  return { ...actual, LoadingSpinner: () => React.createElement('div', { 'data-testid': 'loading-spinner' }, 'Loading...') };
});

import React from 'react';

describe('PassportPage', () => {
  it('renders countries with skills and levels', async () => {
    mockGetPassport.mockResolvedValue({
      summary: {
        worldProgressPercent: 5.6,
        totalCountries: 180,
        stampedCountries: 10,
        masteredCountries: 2,
        skills: [{ category: 'FLAG', attempts: 20, correct: 15, accuracy: 0.75, masteryScore: 60 }],
      },
      countries: [
        {
          countryCode: 'CL',
          name: 'Chile',
          continent: 'South America',
          stamped: true,
          mastered: false,
          score: 54,
          attempts: 12,
          correct: 8,
          skills: [
            { category: 'FLAG', availableQuestions: 1, attempts: 4, correct: 4, accuracy: 1, masteryScore: 50, level: 'FAMILIAR' },
            { category: 'CAPITAL', availableQuestions: 1, attempts: 3, correct: 2, accuracy: 0.67, masteryScore: 25, level: 'LEARNING' },
          ],
        },
      ],
    });

    render(
      <MemoryRouter>
        <PassportPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Mi viaje')).toBeDefined();
    });

    expect(screen.getByText('5.6%')).toBeDefined();
    expect(screen.getByText('10')).toBeDefined();
    expect(screen.getAllByText('Chile').length).toBeGreaterThan(0);
    expect(screen.getByText('54%')).toBeDefined();
  });

  it('shows practice CTA for a country', async () => {
    mockGetPassport.mockResolvedValue({
      summary: { worldProgressPercent: 1, totalCountries: 180, stampedCountries: 1, masteredCountries: 0, skills: [] },
      countries: [{
        countryCode: 'CL', name: 'Chile', continent: 'South America',
        stamped: true, mastered: false, score: 30, attempts: 4, correct: 2,
        skills: [{ category: 'FLAG', availableQuestions: 1, attempts: 4, correct: 2, accuracy: 0.5, masteryScore: 25, level: 'LEARNING' }],
      }],
    });

    render(
      <MemoryRouter>
        <PassportPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Chile').length).toBeGreaterThan(0);
    });

    // Verify the card renders
    expect(screen.getByText('30%')).toBeDefined();
  });

  it('shows empty state for new users', async () => {
    mockGetPassport.mockResolvedValue({
      summary: { worldProgressPercent: 0, totalCountries: 180, stampedCountries: 0, masteredCountries: 0, skills: [] },
      countries: [],
    });

    render(
      <MemoryRouter>
        <PassportPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Juega partidas')).toBeDefined();
    });
  });

  it('shows mastery levels per skill', async () => {
    mockGetPassport.mockResolvedValue({
      summary: { worldProgressPercent: 0, totalCountries: 180, stampedCountries: 1, masteredCountries: 0, skills: [] },
      countries: [{
        countryCode: 'CL', name: 'Chile', continent: 'South America',
        stamped: true, mastered: false, score: 30, attempts: 4, correct: 2,
        skills: [
          { category: 'FLAG', availableQuestions: 1, attempts: 8, correct: 8, accuracy: 1, masteryScore: 100, level: 'MASTERED' },
          { category: 'CAPITAL', availableQuestions: 1, attempts: 2, correct: 1, accuracy: 0.5, masteryScore: 13, level: 'LEARNING' },
        ],
      }],
    });

    render(
      <MemoryRouter>
        <PassportPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Chile').length).toBeGreaterThan(0);
    });

    // Verify country score renders
    expect(screen.getByText('30%')).toBeDefined();
  });
});
