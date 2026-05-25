import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FlagDisplay } from '../components/FlagDisplay';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

const SAMPLE_URL = 'https://flagcdn.com/w320/cl.png';
const SAMPLE_ID = 'question-abc-123';

describe('FlagDisplay', () => {
  it('renderiza la imagen sin filtros cuando modifier=none', () => {
    render(<FlagDisplay imageUrl={SAMPLE_URL} modifier="none" questionId={SAMPLE_ID} />);
    const container = screen.getByTestId('flag-display');
    expect(container).toHaveAttribute('data-modifier', 'none');

    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img!.style.filter).toBe('');
    expect(img!.style.transform).toBe('');
  });

  it('aplica filter grayscale cuando modifier=grayscale', () => {
    render(<FlagDisplay imageUrl={SAMPLE_URL} modifier="grayscale" questionId={SAMPLE_ID} />);
    const img = screen.getByTestId('flag-display').querySelector('img');
    expect(img!.style.filter).toContain('grayscale(1)');
    expect(img!.style.transform).toBe('');
  });

  it('aplica transform scale + origin cuando modifier=crop', () => {
    render(<FlagDisplay imageUrl={SAMPLE_URL} modifier="crop" questionId={SAMPLE_ID} />);
    const container = screen.getByTestId('flag-display');
    const img = container.querySelector('img');
    expect(img!.style.transform).toMatch(/scale\(2\.5\)/);
    expect(img!.style.transformOrigin).toBeTruthy();
    // El crop-origin debe quedar expuesto como data-attr para QA visual.
    expect(container.getAttribute('data-crop-origin')).toBeTruthy();
    expect(img!.style.filter).toBe('');
  });

  it('combined apila grayscale + transform', () => {
    render(<FlagDisplay imageUrl={SAMPLE_URL} modifier="combined" questionId={SAMPLE_ID} />);
    const img = screen.getByTestId('flag-display').querySelector('img');
    expect(img!.style.filter).toContain('grayscale(1)');
    expect(img!.style.transform).toMatch(/scale\(2\.5\)/);
  });

  it('similar NO modifica la imagen visualmente (sólo cambia las opciones server-side)', () => {
    render(<FlagDisplay imageUrl={SAMPLE_URL} modifier="similar" questionId={SAMPLE_ID} />);
    const img = screen.getByTestId('flag-display').querySelector('img');
    expect(img!.style.filter).toBe('');
    expect(img!.style.transform).toBe('');
  });

  it('crop origin es determinístico: mismo questionId → mismo origin', () => {
    const { unmount } = render(
      <FlagDisplay imageUrl={SAMPLE_URL} modifier="crop" questionId={SAMPLE_ID} />
    );
    const first = screen.getByTestId('flag-display').getAttribute('data-crop-origin');
    unmount();

    render(<FlagDisplay imageUrl={SAMPLE_URL} modifier="crop" questionId={SAMPLE_ID} />);
    const second = screen.getByTestId('flag-display').getAttribute('data-crop-origin');
    expect(first).toBe(second);
  });

  it('crop origins distintos para questionIds distintos (probabilísticamente)', () => {
    // Tomamos varios IDs y verificamos que produzcan al menos 2 origins distintos.
    const ids = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'];
    const origins = new Set<string>();
    for (const id of ids) {
      const { unmount } = render(
        <FlagDisplay imageUrl={SAMPLE_URL} modifier="crop" questionId={id} />
      );
      const origin = screen.getByTestId('flag-display').getAttribute('data-crop-origin');
      if (origin) origins.add(origin);
      unmount();
    }
    expect(origins.size).toBeGreaterThanOrEqual(2);
  });

  it('muestra fallback "imagen no disponible" cuando no hay URL', () => {
    render(<FlagDisplay imageUrl={undefined} modifier="none" questionId={SAMPLE_ID} />);
    expect(screen.getByText(/Bandera no disponible|no disponible/i)).toBeTruthy();
  });

  it('alt text refleja el modifier para lectores de pantalla', () => {
    const { unmount: u1 } = render(
      <FlagDisplay imageUrl={SAMPLE_URL} modifier="grayscale" questionId="q-a" />
    );
    expect(screen.getByAltText(/grises/i)).toBeTruthy();
    u1();

    const { unmount: u2 } = render(
      <FlagDisplay imageUrl={SAMPLE_URL} modifier="crop" questionId="q-b" />
    );
    expect(screen.getByAltText(/recortada/i)).toBeTruthy();
    u2();

    render(<FlagDisplay imageUrl={SAMPLE_URL} modifier="combined" questionId="q-c" />);
    expect(screen.getByAltText(/recortada y en escala de grises/i)).toBeTruthy();
  });
});
