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
    expect(tray).toHaveClass('max-h-[45dvh]');
    expect(screen.getByRole('button', { name: 'Siguiente' })).toHaveClass('sticky');
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
    expect(submitButton.className).toContain('disabled:opacity-70');
    expect(submitButton.className).toContain('disabled:cursor-not-allowed');
    expect(submitButton.className).toContain('py-1.5');
  });

  it('al seleccionar sólo habilita Confirmar y mantiene la ayuda fuera del layout visible', () => {
    const { rerender } = render(
      <RoundActionTray
        mode="single"
        showResult={false}
        canSubmit={false}
        submitLabel="Confirmar"
        onSubmit={vi.fn()}
      />
    );

    const buttonBeforeSelection = screen.getByRole('button', { name: 'Confirmar' });
    const buttonClassName = buttonBeforeSelection.className;
    const actionContainer = buttonBeforeSelection.parentElement;
    expect(buttonBeforeSelection).toBeDisabled();
    expect(actionContainer?.children).toHaveLength(1);

    rerender(
      <RoundActionTray
        mode="single"
        showResult={false}
        canSubmit
        submitLabel="Confirmar"
        selectionAssistiveText="Selección lista para confirmar."
        onSubmit={vi.fn()}
      />
    );

    const submitButton = screen.getByRole('button', { name: 'Confirmar' });
    const assistiveText = screen.getByText('Selección lista para confirmar.');
    expect(submitButton).toBeEnabled();
    expect(submitButton.className).toBe(buttonClassName);
    expect(assistiveText).toHaveClass('sr-only');
    expect(assistiveText).toHaveAttribute('aria-live', 'polite');
    expect(submitButton.parentElement).toBe(actionContainer);
    expect(actionContainer?.children).toHaveLength(2);
    for (const child of Array.from(actionContainer?.children ?? [])) {
      expect(child.tagName === 'BUTTON' || child.classList.contains('sr-only')).toBe(true);
    }
  });

  it('mantiene la misma acción y geometría al validar, avanzar y terminar una ronda estable', () => {
    const { rerender } = render(
      <RoundActionTray
        mode="single"
        stableAction
        showResult={false}
        canSubmit={false}
        submitLabel="Confirmar"
        validatingLabel="Validando…"
        nextLabel="Siguiente"
        onSubmit={vi.fn()}
      />
    );

    const button = screen.getByRole('button', { name: 'Confirmar' });
    const className = button.className;
    expect(button).toBeDisabled();
    expect(className).toContain('min-h-12');

    rerender(
      <RoundActionTray mode="single" stableAction showResult={false} canSubmit submitLabel="Confirmar" validatingLabel="Validando…" nextLabel="Siguiente" onSubmit={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Confirmar' })).toHaveClass('min-h-12');

    rerender(
      <RoundActionTray mode="single" stableAction showResult={false} canSubmit isSubmitting submitLabel="Confirmar" validatingLabel="Validando…" nextLabel="Siguiente" onSubmit={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Validando…' })).toHaveClass('min-h-12');

    rerender(
      <RoundActionTray mode="single" stableAction showResult canSubmit submitLabel="Confirmar" nextLabel="Ver resultados" onSubmit={vi.fn()} onNext={vi.fn()} />
    );
    const resultButton = screen.getByRole('button', { name: 'Ver resultados' });
    expect(resultButton.className).toBe(className);
  });
});
