import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameMechanicKey } from '../types';

type MechanicsHudProps = {
  disabled?: boolean;
  available: Record<GameMechanicKey, number>;
  onUseIntel5050?: () => void;
  onUseFocusTime?: () => void;
  /**
   * Muestra un coach-mark no-bloqueante la primera vez que el usuario juega
   * con mecánicas habilitadas. `MechanicsHud` no tiene acceso al game mode o
   * a localStorage de "primera vez" por sí solo — la página que lo renderiza
   * decide cuándo pasar `true` (ver nota en el reporte del agente).
   */
  showFirstUseCoachmark?: boolean;
};

function MechanicButton({
  label,
  icon,
  count,
  disabled,
  onClick,
  tooltip,
}: {
  label: string;
  icon: string;
  count: number;
  disabled: boolean;
  onClick?: () => void;
  tooltip: string;
}) {
  const tooltipId = useId();
  const [tooltipVisible, setTooltipVisible] = useState(false);

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || !onClick}
        className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/90 px-3 py-2 text-left text-[var(--color-text-primary)] transition-all duration-150 hover:border-primary/50 hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50 pressable"
        aria-label={`${label} (${count})`}
        aria-describedby={tooltipId}
      >
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="text-base">{icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold leading-tight">{label}</p>
            <p className="text-[0.68rem] leading-tight text-[var(--color-text-muted)]">x{count}</p>
          </div>
        </div>
      </button>

      {/* Affordance táctil: en desktop el tooltip ya aparece con hover del
          botón (`group-hover`), pero en mobile no hay hover, así que este "i"
          da una forma explícita de revelar el tooltip con un tap. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setTooltipVisible((prev) => !prev);
        }}
        aria-label={tooltip}
        aria-expanded={tooltipVisible}
        className="pressable absolute -right-1 -top-1 flex min-h-6 min-w-6 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[0.6rem] font-bold text-[var(--color-text-muted)] shadow-sm transition-colors hover:text-primary"
      >
        i
      </button>

      <p
        id={tooltipId}
        role="tooltip"
        className={`pointer-events-none absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-[0.68rem] leading-snug text-[var(--color-text-secondary)] shadow-lg transition-opacity duration-150 ${
          tooltipVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        {tooltip}
      </p>
    </div>
  );
}

export function MechanicsHud({
  disabled = false,
  available,
  onUseIntel5050,
  onUseFocusTime,
  showFirstUseCoachmark = false,
}: MechanicsHudProps) {
  const { t } = useTranslation();
  const [coachmarkDismissed, setCoachmarkDismissed] = useState(false);
  const showCoachmark = showFirstUseCoachmark && !coachmarkDismissed;

  return (
    <div className="relative" data-testid="mechanics-hud">
      {showCoachmark && (
        <div
          role="status"
          className="pressable mb-2 flex items-center justify-between gap-2 rounded-lg border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
        >
          <span>{t('mechanics.coachmarkTitle')}</span>
          <button
            type="button"
            onClick={() => setCoachmarkDismissed(true)}
            aria-label={t('common.close')}
            className="flex min-h-6 min-w-6 items-center justify-center rounded-full text-primary/80 hover:text-primary"
          >
            ✕
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <MechanicButton
          icon="🧠"
          label={t('mechanics.intel5050')}
          tooltip={t('mechanics.intel5050Tooltip')}
          count={available.intel5050}
          disabled={disabled || available.intel5050 <= 0}
          onClick={onUseIntel5050}
        />
        <MechanicButton
          icon="⏱️"
          label={t('mechanics.focusTime')}
          tooltip={t('mechanics.focusTimeTooltip')}
          count={available.focusTime}
          disabled={disabled || available.focusTime <= 0}
          onClick={onUseFocusTime}
        />
      </div>
    </div>
  );
}
