import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RoundActionTray } from '../components/RoundActionTray';

describe('RoundActionTray', () => {
  it('reutiliza el layout base y muestra acciones de envío/limpiar en estado activo', () => {
    const onSubmit = vi.fn();
    const onClear = vi.fn();

    render(
      <RoundActionTray
        mode="single"
        showResult={false}
        canSubmit
        submitLabel="Enviar"
        clearLabel="Limpiar"
        onSubmit={onSubmit}
        onClear={onClear}
        showClearButton
      />
    );

    const tray = screen.getByTestId('mobile-action-tray');
    expect(tray).toHaveClass('sticky');
    expect(tray).toHaveClass('bottom-0');

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('usa variante de desafío con contenedor fijo y CTA de siguiente en resultados', () => {
    const onNext = vi.fn();

    render(
      <RoundActionTray
        mode="challenge"
        showResult
        canSubmit
        submitLabel="Enviar"
        clearLabel="Limpiar"
        nextLabel="Siguiente"
        onSubmit={vi.fn()}
        onNext={onNext}
        onClear={vi.fn()}
        summarySlot={<div>resumen</div>}
      />
    );

    const tray = screen.getByTestId('mobile-action-tray');
    expect(tray).toHaveClass('fixed');
    expect(screen.getByText('resumen')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
