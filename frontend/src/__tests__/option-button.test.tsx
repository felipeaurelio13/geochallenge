import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OptionButton } from '../components/OptionButton';

describe('OptionButton visual feedback', () => {
  it('shows stronger visual selected feedback before submitting', () => {
    render(
      <OptionButton
        option="Argentina"
        index={0}
        onClick={vi.fn()}
        disabled={false}
        selected
        showResult={false}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('ring-2');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Opción seleccionada')).toBeInTheDocument();
  });

  it('calls onClick when user taps the option', () => {
    const onClick = vi.fn();

    render(
      <OptionButton
        option="Chile"
        index={1}
        onClick={onClick}
        disabled={false}
        selected={false}
        showResult={false}
      />
    );

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
