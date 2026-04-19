import { useTranslation } from 'react-i18next';
import type { GameMechanicKey } from '../types';

type MechanicsHudProps = {
  compact?: boolean;
  disabled?: boolean;
  available: Record<GameMechanicKey, number>;
  onUseIntel5050?: () => void;
  onUseFocusTime?: () => void;
  showShieldStatus?: boolean;
};

function MechanicButton({
  label,
  icon,
  count,
  disabled,
  onClick,
}: {
  label: string;
  icon: string;
  count: number;
  disabled: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className="min-h-11 rounded-xl border border-gray-700 bg-gray-900/90 px-3 py-2 text-left text-gray-100 transition-colors hover:border-gray-500 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
      aria-label={`${label} (${count})`}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-base">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-tight">{label}</p>
          <p className="text-[0.68rem] leading-tight text-gray-400">x{count}</p>
        </div>
      </div>
    </button>
  );
}

export function MechanicsHud({
  compact = false,
  disabled = false,
  available,
  onUseIntel5050,
  onUseFocusTime,
  showShieldStatus = false,
}: MechanicsHudProps) {
  const { t } = useTranslation();

  return (
    <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`} data-testid="mechanics-hud">
      <MechanicButton
        icon="🧠"
        label={t('mechanics.intel5050')}
        count={available.intel5050}
        disabled={disabled || available.intel5050 <= 0}
        onClick={onUseIntel5050}
      />
      <MechanicButton
        icon="⏱️"
        label={t('mechanics.focusTime')}
        count={available.focusTime}
        disabled={disabled || available.focusTime <= 0}
        onClick={onUseFocusTime}
      />
      {showShieldStatus && (
        <div
          className="min-h-11 rounded-xl border border-gray-700 bg-gray-900/90 px-3 py-2 text-left text-gray-100"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-base">🛡️</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-tight">{t('mechanics.streakShield')}</p>
              <p className="text-[0.68rem] leading-tight text-gray-400">
                {available.streakShield > 0 ? t('mechanics.available') : t('mechanics.consumed')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

