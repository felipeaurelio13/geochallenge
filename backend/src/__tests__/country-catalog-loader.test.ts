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

    const { loadCountryCatalog, getActiveCountries, getSeedCountries } = await import(
      '../utils/countryCatalog.js'
    );
    const loaded = loadCountryCatalog();

    expect(loaded).toHaveLength(1);
    expect(loaded[0].iso2).toBe('AR');
    expect(getActiveCountries(loaded)).toHaveLength(1);
    expect(getSeedCountries(loaded, false).countries).toHaveLength(1);
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

  it('excludes extended rollout countries when extended flags are disabled', async () => {
    const { getSeedCountries } = await import('../utils/countryCatalog.js');

    const selection = getSeedCountries(
      [
        {
          iso2: 'AR',
          name: 'Argentina',
          capital: 'Buenos Aires',
          continent: 'South America',
          lat: -34.6,
          lng: -58.3,
          flag: 'ar',
          status: 'active',
          rollout: 'stable',
        },
        {
          iso2: 'XK',
          name: 'Kosovo',
          capital: 'Pristina',
          continent: 'Europe',
          lat: 42.7,
          lng: 21.1,
          flag: 'xk',
          status: 'active',
          rollout: 'extended',
        },
      ],
      false
    );

    expect(selection.countries).toHaveLength(1);
    expect(selection.countries[0].name).toBe('Argentina');
    expect(selection.extendedCountriesIncluded).toBe(0);
    expect(selection.extendedCountriesExcluded).toBe(1);
  });

  it('includes extended rollout countries when extended flags are enabled', async () => {
    const { getSeedCountries } = await import('../utils/countryCatalog.js');

    const selection = getSeedCountries(
      [
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
        {
          iso2: 'XK',
          name: 'Kosovo',
          capital: 'Pristina',
          continent: 'Europe',
          lat: 42.7,
          lng: 21.1,
          flag: 'xk',
          status: 'active',
          rollout: 'extended',
        },
      ],
      true
    );

    expect(selection.countries).toHaveLength(2);
    expect(selection.extendedCountriesIncluded).toBe(1);
    expect(selection.extendedCountriesExcluded).toBe(0);
  });
});
