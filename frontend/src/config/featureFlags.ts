import type { GameType } from '../types';

function parseBoolFlag(value: string | undefined, fallback: boolean): boolean {
  if (typeof value === 'undefined') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
}

type ModeFlagSet = {
  single: boolean;
  streak: boolean;
  flash: boolean;
  duel: boolean;
  challenge: boolean;
};

export const featureFlags = {
  uxV2: {
    single: parseBoolFlag(import.meta.env.VITE_UX_V2_SINGLE, true),
    streak: parseBoolFlag(import.meta.env.VITE_UX_V2_STREAK, true),
    flash: parseBoolFlag(import.meta.env.VITE_UX_V2_FLASH, true),
    duel: parseBoolFlag(import.meta.env.VITE_UX_V2_DUEL, false),
    challenge: parseBoolFlag(import.meta.env.VITE_UX_V2_CHALLENGE, false),
  } satisfies ModeFlagSet,
  mechanicsV2: {
    single: parseBoolFlag(import.meta.env.VITE_MECHANICS_V2_SINGLE, true),
    streak: parseBoolFlag(import.meta.env.VITE_MECHANICS_V2_STREAK, true),
    flash: parseBoolFlag(import.meta.env.VITE_MECHANICS_V2_FLASH, true),
    duel: parseBoolFlag(import.meta.env.VITE_MECHANICS_V2_DUEL, false),
    challenge: parseBoolFlag(import.meta.env.VITE_MECHANICS_V2_CHALLENGE, false),
  } satisfies ModeFlagSet,
  telemetry: {
    enabled: parseBoolFlag(import.meta.env.VITE_UX_TELEMETRY_ENABLED, true),
    debugConsole: parseBoolFlag(import.meta.env.VITE_UX_TELEMETRY_DEBUG, false),
  },
};

type ExperienceMode = GameType | 'duel' | 'challenge';

export function isUxV2Enabled(mode: ExperienceMode): boolean {
  return featureFlags.uxV2[mode];
}

export function areMechanicsV2Enabled(mode: ExperienceMode): boolean {
  return featureFlags.mechanicsV2[mode];
}

