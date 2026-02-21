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
    expect(button.className).toContain('ring-2');
    expect(button.className).toContain('option-button-base');
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
    expect(optionText.className).toContain('[overflow-wrap:anywhere]');
  });
});
