import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RoundActionTray } from '../components/RoundActionTray';

describe('RoundActionTray', () => {
  it('mantiene la acción principal siempre visible con contenedor fijo en mobile', () => {
    const onSubmit = vi.fn();

    render(
      <RoundActionTray
        mode="single"
        showResult={false}
        canSubmit
        submitLabel="Enviar"
        onSubmit={onSubmit}
      />
    );

    const tray = screen.getByTestId('mobile-action-tray');
    expect(tray).toHaveClass('fixed');
    expect(tray).toHaveClass('bottom-0');

    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

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
        nextLabel="Siguiente"
        onSubmit={vi.fn()}
        onNext={onNext}
        summarySlot={<div>resumen</div>}
      />
    );

    const tray = screen.getByTestId('mobile-action-tray');
    expect(tray).toHaveClass('fixed');
    expect(screen.getByText('resumen')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('muestra ayuda breve al tener selección lista para confirmar', () => {
    render(
      <RoundActionTray
        mode="single"
        showResult={false}
        canSubmit
        submitLabel="Confirmar"
        selectionAssistiveText="Selección lista para confirmar."
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('Selección lista para confirmar.')).toBeInTheDocument();
  });

});
