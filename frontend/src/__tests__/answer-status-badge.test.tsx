import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnswerStatusBadge } from '../components/AnswerStatusBadge';

describe('AnswerStatusBadge', () => {
  it('renderiza variantes correct e incorrect con estilos consistentes', () => {
    const { rerender } = render(<AnswerStatusBadge status="correct" label="Correcta" />);

    expect(screen.getByText('Correcta')).toBeInTheDocument();
    expect(screen.getByText('Correcta').className).toContain('text-green-300');

    rerender(<AnswerStatusBadge status="incorrect" label="Incorrecta" />);

    expect(screen.getByText('Incorrecta')).toBeInTheDocument();
    expect(screen.getByText('Incorrecta').className).toContain('text-red-300');
  });
});
