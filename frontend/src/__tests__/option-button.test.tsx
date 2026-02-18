import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OptionButton } from '../components/OptionButton';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const dictionary: Record<string, string> = {
        'game.correctLabel': 'Correcta',
        'game.incorrectLabel': 'Incorrecta',
      };

      return dictionary[key] ?? key;
    },
  }),
}));

describe('OptionButton', () => {
  it('muestra feedback visual y accesible cuando la alternativa está seleccionada', () => {
    const onClick = vi.fn();

    render(
      <OptionButton
        option="Argentina"
        index={0}
        onClick={onClick}
        disabled={false}
        selected
        showResult={false}
      />
    );

    const button = screen.getByRole('button');

    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button.className).toContain('ring-2');
    expect(button.className).toContain('min-h-[54px]');
    expect(screen.getByText('✓')).toBeInTheDocument();

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('oculta el badge de seleccionada cuando se muestra el resultado', () => {
    render(
      <OptionButton
        option="Argentina"
        index={0}
        onClick={() => {}}
        disabled
        selected
        isCorrect={false}
        showResult
      />
    );

    expect(screen.queryByText('✓')).not.toBeInTheDocument();
    expect(screen.getByText('Incorrecta')).toBeInTheDocument();
  });

  it('mantiene textos largos dentro del contenedor para una lectura mobile-friendly', () => {
    render(
      <OptionButton
        option="AndorraLaVellaAndorraLaVellaAndorraLaVella"
        index={2}
        onClick={() => {}}
        disabled={false}
        selected={false}
        showResult={false}
      />
    );

    const optionText = screen.getByText('AndorraLaVellaAndorraLaVellaAndorraLaVella');
    expect(optionText.className).toContain('[overflow-wrap:anywhere]');
  });
});
