import { describe, expect, it, vi, afterEach } from 'vitest';

describe('country catalog loader', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('loads versioned catalog when available', async () => {
    vi.doMock('fs', () => ({
      readFileSync: vi.fn(() =>
        JSON.stringify({
          version: 'v1',
          countries: [
            {
              iso2: 'AR',
              name: 'Argentina',
              capital: 'Buenos Aires',
              continent: 'South America',
              lat: -34.6,
              lng: -58.3,
              flag: 'ar',
              status: 'active',
            },
          ],
        })
      ),
    }));

    const { loadCountryCatalog, getActiveCountries } = await import('../utils/countryCatalog.js');
    const loaded = loadCountryCatalog();

    expect(loaded).toHaveLength(1);
    expect(loaded[0].iso2).toBe('AR');
    expect(getActiveCountries(loaded)).toHaveLength(1);
  });

  it('falls back to legacy countries.json when versioned catalog is unavailable', async () => {
    vi.doMock('fs', () => ({
      readFileSync: vi
        .fn()
        .mockImplementationOnce(() => {
          throw new Error('missing catalog');
        })
        .mockImplementationOnce(() =>
          JSON.stringify({
            countries: [
              {
                name: 'Chile',
                capital: 'Santiago',
                continent: 'South America',
                lat: -33.4,
                lng: -70.6,
                flag: 'cl',
              },
            ],
          })
        ),
    }));

    const { loadCountryCatalog } = await import('../utils/countryCatalog.js');
    const loaded = loadCountryCatalog();

    expect(loaded).toHaveLength(1);
    expect(loaded[0].status).toBe('active');
    expect(loaded[0].iso2).toBe('CL');
  });
});
