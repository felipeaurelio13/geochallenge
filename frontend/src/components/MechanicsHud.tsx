import { useTranslation } from 'react-i18next';
import type { GameMechanicKey } from '../types';

type MechanicsHudProps = {
  disabled?: boolean;
  available: Record<GameMechanicKey, number>;
  onUseIntel5050?: () => void;
  onUseFocusTime?: () => void;
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
      className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/90 px-3 py-2 text-left text-[var(--color-text-primary)] transition-all duration-150 hover:border-primary/50 hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50 pressable"
      aria-label={`${label} (${count})`}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-base">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-tight">{label}</p>
          <p className="text-[0.68rem] leading-tight text-[var(--color-text-muted)]">x{count}</p>
        </div>
      </div>
    </button>
  );
}

export function MechanicsHud({
  disabled = false,
  available,
  onUseIntel5050,
  onUseFocusTime,
}: MechanicsHudProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-2" data-testid="mechanics-hud">
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
    </div>
  );
}

