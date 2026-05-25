import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuestionCard } from '../components/QuestionCard';
import type { Question } from '../types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'es' },
    t: (key: string, vars?: Record<string, string | number>) => {
      if (key === 'game.questionCapital') {
        return `¿Cuál es la capital de ${vars?.country ?? ''}?`;
      }

      if (key === 'game.questionMap') {
        return `¿Dónde está ${vars?.capital ?? ''}?`;
      }

      if (key === 'game.questionFlag') {
        return '¿A qué país pertenece esta bandera?';
      }

      if (key === 'game.flagUnavailable') {
        return 'Bandera no disponible';
      }

      if (key === 'game.silhouetteUnavailable') {
        return 'Silueta no disponible';
      }

      if (key === 'game.questionSilhouette') {
        return '¿Qué país representa esta silueta?';
      }

      if (key === 'game.questionOf') {
        return `Pregunta ${vars?.current} de ${vars?.total}`;
      }

      if (key.startsWith('game.difficulty.')) {
        return key;
      }

      return key;
    },
  }),
}));

describe('QuestionCard', () => {
  it('usa questionData serializado en JSON para renderizar el enunciado de capital', () => {
    const question = {
      id: 'q1',
      category: 'CAPITAL',
      questionText: '',
      questionData: '{"country":"Chile"}',
      options: ['Santiago', 'Lima', 'Bogotá', 'Quito'],
      correctAnswer: 'Santiago',
      difficulty: 'MEDIUM',
    } as Question;

    render(<QuestionCard question={question} questionNumber={1} totalQuestions={10} compact />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('¿Cuál es la capital de Chile?');
  });

  it('aumenta el espacio visual de la silueta en modo compacto', () => {
    const question = {
      id: 'q2',
      category: 'SILHOUETTE',
      questionText: '',
      questionData: '',
      imageUrl: 'https://example.com/silhouette.png',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      difficulty: 'MEDIUM',
    } as Question;

    const { container } = render(
      <QuestionCard question={question} questionNumber={2} totalQuestions={10} compact />
    );

    const silhouetteImage = container.querySelector('img');
    expect(silhouetteImage).toHaveClass('h-full');
  });


  it('mantiene ratio fijo y object-contain en banderas para evitar recortes', () => {
    const question = {
      id: 'q4',
      category: 'FLAG',
      questionText: '',
      questionData: '',
      imageUrl: 'https://flagcdn.com/w320/lr.png',
      options: ['Liberia', 'Tanzania', 'Gabon', 'Zimbabwe'],
      correctAnswer: 'Liberia',
      difficulty: 'HARD',
    } as Question;

    const { container } = render(
      <QuestionCard question={question} questionNumber={4} totalQuestions={10} compact />
    );

    const flagImage = container.querySelector('img');
    const flagContainer = flagImage?.parentElement;

    expect(flagContainer?.className).toContain('media-box');
    expect(flagImage).toHaveClass('object-contain');
    expect(flagImage).toHaveClass('h-full');
    expect(flagImage).toHaveClass('w-full');
  });


  it('compacta bandera y dificultad en una sola fila para ganar espacio vertical', () => {
    const question = {
      id: 'q5',
      category: 'FLAG',
      questionText: '',
      questionData: '',
      imageUrl: 'https://flagcdn.com/w320/pe.png',
      options: ['Perú', 'Bolivia', 'Ecuador', 'Paraguay'],
      correctAnswer: 'Perú',
      difficulty: 'MEDIUM',
    } as Question;

    const { container } = render(
      <QuestionCard question={question} questionNumber={5} totalQuestions={10} compact />
    );

    const flagImage = container.querySelector('img');
    const flagContainer = flagImage?.parentElement;
    const heading = screen.getByRole('heading', { level: 2 });
    const difficultyBadge = screen.getByText('game.difficulty.medium');

    expect(flagContainer?.className).toContain('media-box--compact');
    expect(heading.className).toContain('text-[clamp(1.05rem,4vw,1.28rem)]');
    expect(difficultyBadge.className).toContain('absolute');
    expect(difficultyBadge.className).toContain('top-2');
  });
  it('normaliza códigos ISO de bandera en mayúsculas para mantener contrato con flagcdn', () => {
    const question = {
      id: 'q6',
      category: 'FLAG',
      questionText: '',
      questionData: '',
      imageUrl: 'https://flagcdn.com/w320/AR.png',
      options: ['Argentina', 'Uruguay', 'Paraguay', 'Chile'],
      correctAnswer: 'Argentina',
      difficulty: 'EASY',
    } as Question;

    render(<QuestionCard question={question} questionNumber={6} totalQuestions={10} compact />);

    const flagImage = screen.getByRole('img');
    expect(flagImage).toHaveAttribute('src', 'https://flagcdn.com/w320/ar.png');
  });

  it('mantiene render robusto cuando la URL de bandera no cumple el patrón esperado', () => {
    const question = {
      id: 'q7',
      category: 'FLAG',
      questionText: '',
      questionData: '',
      imageUrl: 'https://flagcdn.com/w320/argentina.png',
      options: ['Argentina', 'Uruguay', 'Paraguay', 'Chile'],
      correctAnswer: 'Argentina',
      difficulty: 'EASY',
    } as Question;

    render(<QuestionCard question={question} questionNumber={7} totalQuestions={10} compact />);

    const heading = screen.getByRole('heading', { level: 2 });
    const flagImage = screen.getByRole('img');

    expect(heading).toHaveTextContent('¿A qué país pertenece esta bandera?');
    expect(flagImage).toHaveAttribute('src', 'https://flagcdn.com/w320/argentina.png');
  });

  it('muestra UI de error cuando la imagen de bandera falla al cargar', () => {
    const question = {
      id: 'q-flag-err',
      category: 'FLAG',
      questionText: '',
      questionData: '',
      imageUrl: 'https://flagcdn.com/w320/ar.png',
      options: ['Argentina', 'Uruguay', 'Paraguay', 'Chile'],
      correctAnswer: 'Argentina',
      difficulty: 'EASY',
    } as Question;

    const { container } = render(
      <QuestionCard question={question} questionNumber={1} totalQuestions={10} />
    );

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    // First error: switches to fallback CDN (flagpedia.net)
    fireEvent.error(img!);
    // Second error: exhausts fallback, triggers error UI
    const fallbackImg = container.querySelector('img');
    expect(fallbackImg).not.toBeNull();
    fireEvent.error(fallbackImg!);

    expect(screen.getByText('Bandera no disponible')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('carga la imagen con loading eager para garantizar visibilidad inmediata', () => {
    const question = {
      id: 'q-flag-eager',
      category: 'FLAG',
      questionText: '',
      questionData: '',
      imageUrl: 'https://flagcdn.com/w320/pe.png',
      options: ['Perú', 'Bolivia', 'Ecuador', 'Paraguay'],
      correctAnswer: 'Perú',
      difficulty: 'MEDIUM',
    } as Question;

    const { container } = render(
      <QuestionCard question={question} questionNumber={1} totalQuestions={10} />
    );

    expect(container.querySelector('img')).toHaveAttribute('loading', 'eager');
  });

  it('aplica tipografía más compacta al enunciado del mapa', () => {
    const question = {
      id: 'q3',
      category: 'MAP',
      questionText: '',
      questionData: 'Maseru',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      difficulty: 'MEDIUM',
    } as Question;

    render(<QuestionCard question={question} questionNumber={3} totalQuestions={10} compact />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveClass('text-[clamp(1rem,3.8vw,1.22rem)]', 'leading-snug');
  });

  // --- Cinema & Geography (v2 unified format) ---

  it('muestra el prompt.es de la pregunta Cinema & Geografía como texto del enunciado', () => {
    const question = {
      id: 'cg-1',
      category: 'CINEMA_GEO',
      questionText: '',
      questionData: JSON.stringify({
        id: 'mi-burj-khalifa',
        answerKind: 'city',
        prompt: { es: '¿En qué ciudad se filmó esta escena de MI?', en: 'In which city was this MI scene filmed?' },
        movieTitle: 'Mission: Impossible – Ghost Protocol',
        movieYear: 2011,
      }),
      options: ['Dubai', 'Doha', 'Abu Dhabi', 'Riyadh'],
      correctAnswer: 'Dubai',
      difficulty: 'EASY',
    } as Question;

    render(<QuestionCard question={question} questionNumber={1} totalQuestions={10} />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('¿En qué ciudad se filmó esta escena de MI?');
  });

  it('renderiza la movie card con título y año (la respuesta es un lugar, no spoilea)', () => {
    const question = {
      id: 'cg-2',
      category: 'CINEMA_GEO',
      questionText: '',
      questionData: JSON.stringify({
        id: 'the-shining-timberline',
        answerKind: 'venue',
        prompt: { es: '¿Qué hotel real se usó para el exterior del Overlook?', en: 'Which real hotel was used for the Overlook exterior?' },
        movieTitle: 'The Shining',
        movieYear: 1980,
      }),
      options: ['Timberline Lodge', 'The Stanley Hotel', 'Ahwahnee Hotel', 'Fairmont Banff Springs'],
      correctAnswer: 'Timberline Lodge',
      difficulty: 'MEDIUM',
    } as Question;

    const { container } = render(<QuestionCard question={question} questionNumber={1} totalQuestions={10} />);

    // Movie title and year appear as context (not the answer)
    expect(screen.getByText('The Shining')).toBeInTheDocument();
    expect(screen.getByText(/1980/)).toBeInTheDocument();
    // v2 never carries an image — no <img> element should be rendered
    expect(container.querySelector('img')).toBeNull();
  });

  it('usa prompt.es del payload (no el questionText del backend) cuando i18n=es — fix ROUND2-001', () => {
    // Antes este test verificaba que QuestionCard usara `questionText` del
    // backend (que el backend "supuestamente" localizaba server-side). En la
    // realidad el backend siempre devolvía español, lo que generaba mezcla
    // español/inglés en UIs en otro idioma. Ahora la fuente de verdad es el
    // prompt embebido en questionData, elegido según el i18n del cliente.
    const question = {
      id: 'cg-3',
      category: 'CINEMA_GEO',
      questionText: 'Texto crudo del backend que debe ignorarse',
      questionData: JSON.stringify({
        id: 'lotr-hobbiton',
        answerKind: 'country',
        prompt: { es: '¿En qué país construyeron el set de Hobbiton?', en: 'In which country was the Hobbiton movie set built?' },
        movieTitle: 'The Lord of the Rings',
        movieYear: 2001,
      }),
      options: ['New Zealand', 'Ireland', 'Scotland', 'Iceland'],
      correctAnswer: 'New Zealand',
      difficulty: 'EASY',
    } as Question;

    // El mock de useTranslation devuelve i18n.language = 'es', así que debe
    // mostrarse el prompt.es, no el questionText ni el prompt.en.
    render(<QuestionCard question={question} questionNumber={1} totalQuestions={10} />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('¿En qué país construyeron el set de Hobbiton?');
  });
});
