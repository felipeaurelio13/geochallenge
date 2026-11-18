import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../i18n';
import { DailyTourStrip } from '../components/molecules/DailyTourStrip';
import type { DailyTourDetails } from '../types';

describe('DailyTourStrip', () => {
  const sampleDetails: DailyTourDetails[] = [
    {
      questionId: 'q1',
      countryCode: 'CL',
      category: 'CAPITAL',
      region: 'AMERICAS',
      difficulty: 'EASY',
      isCorrect: true,
      points: 100,
    },
    {
      questionId: 'q2',
      countryCode: 'AR',
      category: 'FLAG',
      region: 'AMERICAS',
      difficulty: 'MEDIUM',
      isCorrect: false,
      points: 0,
    },
    {
      questionId: 'q3',
      countryCode: 'FR',
      category: 'MONUMENT',
      region: 'EUROPE',
      difficulty: 'EASY',
      isCorrect: true,
      points: 100,
    },
  ];

  it('renders nothing when details are empty or undefined', () => {
    const { container: c1 } = render(<DailyTourStrip details={[]} language="es" />);
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(<DailyTourStrip details={undefined as any} language="es" />);
    expect(c2.firstChild).toBeNull();
  });

  it('renders tour stops with localized title and screen reader announcements', () => {
    render(<DailyTourStrip details={sampleDetails} language="es" />);

    // Check that pills are rendered
    const stop1 = screen.getByTitle(/Chile —/);
    expect(stop1).toBeInTheDocument();
    expect(stop1).toHaveTextContent('\u2713');
    expect(stop1).toHaveClass('text-success');

    const stop2 = screen.getByTitle(/Argentina —/);
    expect(stop2).toBeInTheDocument();
    expect(stop2).toHaveTextContent('\u2717');
    expect(stop2).toHaveClass('text-error');

    // Screen reader texts
    const srElements = screen.getAllByText(/—/);
    expect(srElements.length).toBeGreaterThanOrEqual(3);
  });

  it('applies compact layout when compact prop is true', () => {
    const { container: c1 } = render(
      <DailyTourStrip details={sampleDetails} language="es" compact={true} />
    );
    expect(c1.firstElementChild).not.toHaveClass('max-w-sm');

    const { container: c2 } = render(
      <DailyTourStrip details={sampleDetails} language="es" compact={false} />
    );
    expect(c2.firstElementChild).toHaveClass('max-w-sm');
  });
});
