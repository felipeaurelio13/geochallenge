import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RoundActionTray } from '../components/RoundActionTray';

describe('RoundActionTray', () => {
  it('mantiene la acción principal visible en flujo con safe-area inferior reforzada', () => {
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
    expect(tray).toHaveClass('w-full');
    expect(tray.className).toContain('pb-[calc(env(safe-area-inset-bottom)+0.65rem)]');
    expect(tray.className).not.toContain('fixed');
    expect(tray.className).not.toContain('absolute');

    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('usa variante de desafío y mantiene CTA de siguiente en resultados', () => {
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
    expect(tray).toHaveClass('w-full');
    expect(screen.getByText('resumen')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('mantiene contraste legible en botón Confirmar deshabilitado', () => {
    render(
      <RoundActionTray
        mode="single"
        showResult={false}
        canSubmit={false}
        submitLabel="Confirmar"
        onSubmit={vi.fn()}
      />
    );

    const submitButton = screen.getByRole('button', { name: 'Confirmar' });
    expect(submitButton).toBeDisabled();
    expect(submitButton.className).toContain('disabled:bg-slate-600/95');
    expect(submitButton.className).toContain('disabled:text-slate-100/85');
    expect(submitButton.className).toContain('py-1.5');
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
