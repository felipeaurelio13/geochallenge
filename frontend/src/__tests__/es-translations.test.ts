import { describe, expect, it } from 'vitest';
import es from '../i18n/es.json';

describe('traducciones en español', () => {
  it('usa tildes y signos de apertura en textos clave', () => {
    expect(es.auth.forgotPassword).toBe('¿Olvidaste tu contraseña?');
    expect(es.game.confirmExit).toBe('¿Seguro que quieres salir? Perderás tu progreso.');
    expect(es.game.score).toBe('Puntuación');
    expect(es.game.questionCapital).toBe('¿Cuál es la capital de {{country}}?');
    expect(es.game.selectOptionHint).toBe('Selecciona una alternativa para continuar.');
    expect(es.game.selectOnMapHint).toBe('Marca una ubicación en el mapa para continuar.');
    expect(es.game.lowTimeHint).toBe('Te quedan {{seconds}} segundos. Respira y confirma tu respuesta.');
    expect(es.results.newHighScore).toBe('¡Nuevo récord!');
    expect(es.challenges.title).toBe('Desafíos');
    expect(es.challenges.createMultiplayerCta).toBe('Crear desafío multijugador');
    expect(es.rankings.empty).toBe('Aún no hay jugadores en el ranking');
    expect(es.common.success).toBe('Éxito');
  });
});
