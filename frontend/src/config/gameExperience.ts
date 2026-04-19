import type { GameType } from '../types';
import { featureFlags } from './featureFlags';

export type GameplayMode = GameType | 'duel' | 'challenge';

export type GameExperienceConfig = {
  mode: GameplayMode;
  uxV2Enabled: boolean;
  mechanicsEnabled: boolean;
  minTouchTargetPx: number;
  verticalDensity: 'compact' | 'balanced';
  entryMotionMs: number;
  buttonMotionMs: number;
  preserveSafeArea: boolean;
};

const BASE_EXPERIENCE: Omit<GameExperienceConfig, 'mode' | 'uxV2Enabled' | 'mechanicsEnabled'> = {
  minTouchTargetPx: 44,
  verticalDensity: 'balanced',
  entryMotionMs: 180,
  buttonMotionMs: 140,
  preserveSafeArea: true,
};

export function getGameExperienceConfig(mode: GameplayMode): GameExperienceConfig {
  const uxV2Enabled = featureFlags.uxV2[mode];
  const mechanicsEnabled = featureFlags.mechanicsV2[mode];

  if (mode === 'flash') {
    return {
      ...BASE_EXPERIENCE,
      mode,
      uxV2Enabled,
      mechanicsEnabled,
      verticalDensity: 'compact',
      buttonMotionMs: 120,
    };
  }

  return {
    ...BASE_EXPERIENCE,
    mode,
    uxV2Enabled,
    mechanicsEnabled,
  };
}

