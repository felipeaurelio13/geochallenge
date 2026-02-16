import { describe, expect, it } from 'vitest';
import { resolveViteBase } from '../utils/deployBase';

describe('resolveViteBase', () => {
  it('prioriza VITE_BASE_PATH configurado manualmente', () => {
    expect(resolveViteBase({ viteBasePath: '/custom-path' })).toBe('/custom-path/');
  });

  it('usa el nombre del repositorio en GitHub Actions para Pages', () => {
    expect(
      resolveViteBase({
        githubActions: 'true',
        githubRepository: 'org/geochallenge',
      })
    ).toBe('/geochallenge/');
  });

  it('usa raiz en local cuando no hay configuracion de Pages', () => {
    expect(resolveViteBase({})).toBe('/');
  });
});
