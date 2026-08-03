import { describe, expect, it } from 'vitest';
import {
  buildGeoChallengeDuelGame,
  buildGeoChallengeGame,
  isGeoChallengeAnswerCorrect,
  loadGeoChallengeCatalog,
  toPublicGeoChallengeRound,
} from '../services/geoChallenge.service';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

describe('GeoRetos catalog', () => {
  it('covers the 197 supported countries with usable relational data', () => {
    const catalog = loadGeoChallengeCatalog();
    expect(catalog.version).toBe('v1');
    expect(catalog.countries).toHaveLength(197);

    const supported = new Set(catalog.countries.map((country) => country.iso2));
    for (const country of catalog.countries) {
      expect(country.population).toBeGreaterThan(0);
      expect(country.areaKm2).toBeGreaterThan(0);
      expect(Number.isFinite(country.capitalLat)).toBe(true);
      expect(country.languages.length).toBeGreaterThan(0);
      expect(country.neighbors.every((neighbor) => supported.has(neighbor))).toBe(true);
    }
  });
});

describe('GeoRetos game generation', () => {
  it('always generates the five mechanics with valid answer contracts', () => {
    const expectedKinds = [
      'EXTREME',
      'HIGHER_LOWER',
      'COMMON_NEIGHBOR',
      'ODD_ONE_OUT',
      'NORTH_TO_SOUTH',
    ];

    for (let seed = 1; seed <= 50; seed += 1) {
      const game = buildGeoChallengeGame(seededRandom(seed));
      expect(game.rounds.map((round) => round.kind)).toEqual(expectedKinds);
      expect(new Set(game.rounds.map((round) => round.region))).toEqual(new Set([
        'AFRICA',
        'AMERICAS',
        'ASIA',
        'EUROPE',
        'OCEANIA',
      ]));
      expect(game.timePerRound).toBe(25);

      const involvedCountryIds = game.rounds.flatMap((round) => round.involvedCountryIds);
      expect(new Set(involvedCountryIds).size).toBe(involvedCountryIds.length);

      for (const round of game.rounds) {
        const optionIds = round.options.map((option) => option.id);
        expect(new Set(optionIds).size).toBe(optionIds.length);
        expect(round.correctOptionIds.every((optionId) => optionIds.includes(optionId))).toBe(true);
        expect(round.prompt.es.length).toBeGreaterThan(10);
        expect(round.prompt.en.length).toBeGreaterThan(10);
        expect(round.explanation.es.length).toBeGreaterThan(10);
        expect(round.explanation.en.length).toBeGreaterThan(10);
        expect(['EASY', 'MEDIUM', 'HARD']).toContain(round.difficulty);

        if (round.selectionMode === 'ordered') {
          expect(round.correctOptionIds).toHaveLength(4);
        } else {
          expect(round.correctOptionIds).toHaveLength(1);
        }
      }
    }
  });

  it('can surface every supported country as a correct answer without regional concentration', () => {
    const countriesSeen = new Set<string>();

    for (let seed = 1; seed <= 250; seed += 1) {
      const game = buildGeoChallengeGame(seededRandom(seed));
      for (const round of game.rounds) {
        round.correctOptionIds.forEach((countryId) => countriesSeen.add(countryId));
      }
    }

    expect(countriesSeen.size).toBe(loadGeoChallengeCatalog().countries.length);
  });

  it('keeps solutions and explanations out of the public round payload', () => {
    const round = buildGeoChallengeGame(seededRandom(7)).rounds[0];
    const publicRound = toPublicGeoChallengeRound(round);
    expect(publicRound).not.toHaveProperty('correctOptionIds');
    expect(publicRound).not.toHaveProperty('explanation');
    expect(publicRound).not.toHaveProperty('involvedCountryIds');
    expect(publicRound).toHaveProperty('region');
    expect(publicRound).toHaveProperty('difficulty');
  });

  it('requires exact sequence equality for ordered answers', () => {
    const orderedRound = buildGeoChallengeGame(seededRandom(19)).rounds.find(
      (round) => round.kind === 'NORTH_TO_SOUTH',
    );
    expect(orderedRound).toBeDefined();
    const correct = orderedRound!.correctOptionIds;
    expect(isGeoChallengeAnswerCorrect(correct, correct)).toBe(true);
    expect(isGeoChallengeAnswerCorrect(correct, [...correct].reverse())).toBe(false);
    expect(isGeoChallengeAnswerCorrect(correct, correct.slice(0, 3))).toBe(false);
  });

  it('builds balanced 10-round duels without repeating countries', () => {
    const expectedKinds = [
      'EXTREME',
      'HIGHER_LOWER',
      'COMMON_NEIGHBOR',
      'ODD_ONE_OUT',
      'NORTH_TO_SOUTH',
    ];

    for (let seed = 1; seed <= 30; seed += 1) {
      const game = buildGeoChallengeDuelGame(seededRandom(seed));
      const involvedCountryIds = game.rounds.flatMap((round) => round.involvedCountryIds);

      expect(game.rounds).toHaveLength(10);
      expect(game.timePerRound).toBe(25);
      expect(new Set(involvedCountryIds).size).toBe(involvedCountryIds.length);

      for (const kind of expectedKinds) {
        expect(game.rounds.filter((round) => round.kind === kind)).toHaveLength(2);
      }
      for (const region of ['AFRICA', 'AMERICAS', 'ASIA', 'EUROPE', 'OCEANIA']) {
        expect(game.rounds.filter((round) => round.region === region)).toHaveLength(2);
      }
    }
  });
});
