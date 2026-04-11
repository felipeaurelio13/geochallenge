import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OptionButton } from '../components/OptionButton';

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
    expect(button).toHaveAttribute('data-state', 'selected');
    expect(button.className).toContain('ring-2');
    expect(button.className).toContain('option-button-base');
    expect(button.className).toContain('option-button-shell');
    expect(button.className).toContain('py-2');
    expect(screen.getByText('✓')).toBeInTheDocument();

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('reemplaza la letra por icono de resultado para ahorrar espacio en mobile', () => {
    render(
      <>
        <OptionButton
          option="Argentina"
          index={0}
          onClick={() => {}}
          disabled
          selected
          isCorrect={false}
          showResult
        />
        <OptionButton
          option="Chile"
          index={1}
          onClick={() => {}}
          disabled
          selected={false}
          isCorrect
          showResult
        />
      </>
    );

    expect(screen.getByText('✕')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
    expect(screen.queryByText('Incorrecta')).not.toBeInTheDocument();
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
    expect(optionText.className).toContain('truncate');
  });

  it('mantiene fondo sólido en locked/correct/wrong sin opacity ni transparency', () => {
    const { rerender } = render(
      <OptionButton
        option="Perú"
        index={1}
        onClick={() => {}}
        disabled
        selected={false}
        isCorrect={false}
        showResult
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('data-state', 'locked');
    expect(button.className).toContain('bg-[var(--color-surface-muted)]');
    expect(button.className).not.toContain('opacity');
    expect(button.className).not.toContain('transparent');

    rerender(
      <OptionButton
        option="Perú"
        index={1}
        onClick={() => {}}
        disabled
        selected
        isCorrect={false}
        showResult
      />
    );
    expect(screen.getByRole('button')).toHaveAttribute('data-state', 'wrong');

    rerender(
      <OptionButton
        option="Perú"
        index={1}
        onClick={() => {}}
        disabled
        selected={false}
        isCorrect
        showResult
      />
    );
    expect(screen.getByRole('button')).toHaveAttribute('data-state', 'correct');
  });

  it('reserva espacio del indicador para evitar saltos de alineación al seleccionar', () => {
    const { rerender } = render(
      <OptionButton
        option="Perú"
        index={1}
        onClick={() => {}}
        disabled={false}
        selected={false}
        showResult={false}
      />
    );

    const hiddenIndicator = document.querySelector('.option-button-selected-indicator');
    expect(hiddenIndicator).toBeInTheDocument();
    expect(hiddenIndicator?.className).toContain('bg-transparent');

    rerender(
      <OptionButton
        option="Perú"
        index={1}
        onClick={() => {}}
        disabled={false}
        selected
        showResult={false}
      />
    );

    const visibleIndicator = document.querySelector('.option-button-selected-indicator');
    expect(visibleIndicator?.className).toContain('bg-[var(--color-primary-500)]');
  });

  it('mantiene clases estructurales y padding/altura base en default, selected y showResult', () => {
    const props = {
      option: 'Argentina',
      index: 0,
      onClick: () => {},
      disabled: false,
      selected: false,
      showResult: false,
    } as const;

    const { rerender } = render(<OptionButton {...props} />);

    const assertStableStructure = (expectedState: string) => {
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-state', expectedState);
      expect(button.className).toContain('option-button-shell');
      expect(button.className).toContain('option-button-base');
      expect(button.className).toContain('py-2');

      const indexBadge = document.querySelector('.option-button-index');
      expect(indexBadge).toBeInTheDocument();
      expect(indexBadge?.className).toContain('h-7');

      const indicator = document.querySelector('.option-button-selected-indicator');
      expect(indicator).toBeInTheDocument();
      expect(indicator?.className).toContain('h-6');
      expect(indicator?.className).toContain('w-6');
      expect(indicator?.className).toContain('shrink-0');
    };

    assertStableStructure('default');

    rerender(<OptionButton {...props} selected />);
    assertStableStructure('selected');

    rerender(<OptionButton {...props} disabled selected isCorrect={false} showResult />);
    assertStableStructure('wrong');

    rerender(<OptionButton {...props} disabled selected={false} isCorrect showResult />);
    assertStableStructure('correct');

    rerender(<OptionButton {...props} disabled selected={false} isCorrect={false} showResult />);
    assertStableStructure('locked');
  });
});
