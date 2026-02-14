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
    expect(button.className).toContain('ring-4');
    expect(screen.getByText('✓ Seleccionada')).toBeInTheDocument();

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

    expect(screen.queryByText('✓ Seleccionada')).not.toBeInTheDocument();
    expect(screen.getByText('✗')).toBeInTheDocument();
  });
});
