import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MechanicsHud } from '../components/MechanicsHud';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('MechanicsHud', () => {
  it('renderiza acciones de 50/50 y tiempo con contador disponible', () => {
    render(
      <MechanicsHud
        available={{ intel5050: 1, focusTime: 2, streakShield: 1 }}
        onUseIntel5050={() => {}}
        onUseFocusTime={() => {}}
        showShieldStatus
      />
    );

    expect(screen.getByRole('button', { name: 'mechanics.intel5050 (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'mechanics.focusTime (2)' })).toBeInTheDocument();
    expect(screen.getByText('mechanics.streakShield')).toBeInTheDocument();
  });

  it('deshabilita acciones cuando el contador llega a cero', () => {
    const onUseIntel5050 = vi.fn();
    const onUseFocusTime = vi.fn();

    render(
      <MechanicsHud
        available={{ intel5050: 0, focusTime: 0, streakShield: 0 }}
        onUseIntel5050={onUseIntel5050}
        onUseFocusTime={onUseFocusTime}
      />
    );

    const intelButton = screen.getByRole('button', { name: 'mechanics.intel5050 (0)' });
    const focusButton = screen.getByRole('button', { name: 'mechanics.focusTime (0)' });
    expect(intelButton).toBeDisabled();
    expect(focusButton).toBeDisabled();

    fireEvent.click(intelButton);
    fireEvent.click(focusButton);
    expect(onUseIntel5050).not.toHaveBeenCalled();
    expect(onUseFocusTime).not.toHaveBeenCalled();
  });
});

