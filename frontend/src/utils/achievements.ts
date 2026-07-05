export interface AchievementDisplay {
  key: string;
  icon: string;
  name: string;
  description: string;
}

interface AchievementCatalogEntry {
  nameEs: string;
  nameEn: string;
  descEs: string;
  descEn: string;
  icon: string;
}

// Mirrors the fixed 10-row `Achievement` table seeded in
// backend/prisma/migrations/20260515000000_add_achievements_and_daily_streak.
// Keep in sync with backend/src/services/achievement.service.ts (AchievementKey).
const ACHIEVEMENT_CATALOG: Record<string, AchievementCatalogEntry> = {
  FIRST_GAME: {
    nameEs: 'Primera partida',
    nameEn: 'First Game',
    descEs: 'Jugaste tu primera partida',
    descEn: 'Play your first game',
    icon: '🎯',
  },
  STREAK_10: {
    nameEs: 'Racha de 10',
    nameEn: 'Streak of 10',
    descEs: 'Respondiste 10 seguidas en modo racha',
    descEn: 'Answer 10 in a row in streak mode',
    icon: '🔥',
  },
  STREAK_25: {
    nameEs: 'Imparable',
    nameEn: 'Unstoppable',
    descEs: 'Respondiste 25 seguidas en modo racha',
    descEn: 'Answer 25 in a row in streak mode',
    icon: '⚡',
  },
  STREAK_50: {
    nameEs: 'Geógrafo Elite',
    nameEn: 'Elite Geographer',
    descEs: 'Respondiste 50 seguidas en modo racha',
    descEn: 'Answer 50 in a row in streak mode',
    icon: '🌍',
  },
  PERFECT_GAME: {
    nameEs: 'Partida perfecta',
    nameEn: 'Perfect Game',
    descEs: 'Respondiste todas correctamente en una partida',
    descEn: 'Answer all correctly in a single game',
    icon: '💯',
  },
  HIGH_SCORE_1K: {
    nameEs: 'Cuatro dígitos',
    nameEn: 'Four Digits',
    descEs: 'Alcanzaste 1000 puntos o más',
    descEn: 'Reach 1000 points or more',
    icon: '🏆',
  },
  FIRST_WIN: {
    nameEs: 'Primera victoria',
    nameEn: 'First Victory',
    descEs: 'Ganaste tu primer duelo',
    descEn: 'Win your first duel',
    icon: '⚔️',
  },
  DAILY_FIRST: {
    nameEs: 'Reto del día',
    nameEn: 'Daily Challenge',
    descEs: 'Completaste tu primer reto del día',
    descEn: 'Complete your first daily challenge',
    icon: '📅',
  },
  DAILY_7: {
    nameEs: 'Semana de racha',
    nameEn: 'Week Streak',
    descEs: 'Completaste el reto del día 7 días seguidos',
    descEn: 'Complete the daily 7 days in a row',
    icon: '🗓️',
  },
  DAILY_30: {
    nameEs: 'Mes completo',
    nameEn: 'Full Month',
    descEs: 'Completaste el reto del día 30 días seguidos',
    descEn: 'Complete the daily 30 days in a row',
    icon: '🏅',
  },
};

/**
 * Resolves an achievement key (e.g. "STREAK_10") to its localized display
 * name, description and icon. Falls back to the raw key as the name when
 * the key isn't in the catalog (forward-compat if backend adds new ones
 * before the frontend catalog is updated).
 *
 * `language` should be the active i18next language (e.g. `i18n.language`).
 * Anything other than `'en'` falls back to Spanish, matching the app's
 * fallback-language convention (see i18n/index.ts).
 */
export function getAchievementDisplay(key: string, language: string): AchievementDisplay {
  const entry = ACHIEVEMENT_CATALOG[key];

  if (!entry) {
    return { key, icon: '🏅', name: key, description: '' };
  }

  const isEnglish = language === 'en';

  return {
    key,
    icon: entry.icon,
    name: isEnglish ? entry.nameEn : entry.nameEs,
    description: isEnglish ? entry.descEn : entry.descEs,
  };
}
