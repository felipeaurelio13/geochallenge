import { describe, expect, it } from 'vitest';
import {
  buildGeoChallengeDuelGame,
  buildGeoChallengeGame,
  getGeoChallengeBasePoints,
  isGeoChallengeAnswerCorrect,
  loadGeoChallengeCatalog,
  toPublicGeoChallengeRound,
  ALL_9_KINDS,
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

describe('GeoRetos V2 game generation', () => {
  it('always generates 7 rounds with distinct kinds and all 5 regions', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const game = buildGeoChallengeGame(seededRandom(seed));
      expect(game.engineVersion).toBe('v2');
      expect(game.rounds).toHaveLength(7);
      expect(game.timePerRound).toBe(25);

      const kinds = game.rounds.map((round) => round.kind);
      expect(new Set(kinds).size).toBe(7);

      const regions = new Set(game.rounds.map((round) => round.region));
      expect(regions).toEqual(new Set(['AFRICA', 'AMERICAS', 'ASIA', 'EUROPE', 'OCEANIA']));

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

  it('Oceania appears exactly once in single', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const game = buildGeoChallengeGame(seededRandom(seed));
      const oceaniaCount = game.rounds.filter((r) => r.region === 'OCEANIA').length;
      expect(oceaniaCount).toBe(1);
    }
  });

  it('difficulty never descends: EASY -> MEDIUM -> HARD', () => {
    const order = { EASY: 0, MEDIUM: 1, HARD: 2 };
    for (let seed = 1; seed <= 50; seed += 1) {
      const game = buildGeoChallengeGame(seededRandom(seed));
      let maxSeen = -1;
      for (const round of game.rounds) {
        const level = order[round.difficulty];
        expect(level).toBeGreaterThanOrEqual(maxSeen);
        maxSeen = level;
      }
    }
  });

  it('can surface every supported country as a correct answer', () => {
    const countriesSeen = new Set<string>();
    for (let seed = 1; seed <= 250; seed += 1) {
      const game = buildGeoChallengeGame(seededRandom(seed));
      for (const round of game.rounds) {
        round.correctOptionIds.forEach((countryId) => countriesSeen.add(countryId));
      }
    }
    expect(countriesSeen.size).toBe(loadGeoChallengeCatalog().countries.length);
  });

  it('all 9 mechanics appear across a deterministic sample', () => {
    const kindsSeen = new Set<string>();
    for (let seed = 1; seed <= 200; seed += 1) {
      const game = buildGeoChallengeGame(seededRandom(seed));
      for (const round of game.rounds) {
        kindsSeen.add(round.kind);
      }
    }
    expect(kindsSeen.size).toBe(9);
    for (const kind of ALL_9_KINDS) {
      expect(kindsSeen.has(kind)).toBe(true);
    }
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
    const game = buildGeoChallengeGame(seededRandom(19));
    const orderedRound = game.rounds.find((round) => round.selectionMode === 'ordered');
    expect(orderedRound).toBeDefined();
    const correct = orderedRound!.correctOptionIds;
    expect(isGeoChallengeAnswerCorrect(correct, correct)).toBe(true);
    expect(isGeoChallengeAnswerCorrect(correct, [...correct].reverse())).toBe(false);
    expect(isGeoChallengeAnswerCorrect(correct, correct.slice(0, 3))).toBe(false);
  });

  it('500 seeds single -> 0 generation failures', () => {
    for (let seed = 1; seed <= 500; seed += 1) {
      const game = buildGeoChallengeGame(seededRandom(seed));
      expect(game.rounds).toHaveLength(7);
    }
  });
});

describe('GeoRetos V2 duel generation', () => {
  it('builds 10-round duels without repeating countries', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const game = buildGeoChallengeDuelGame(seededRandom(seed));
      const involvedCountryIds = game.rounds.flatMap((round) => round.involvedCountryIds);

      expect(game.rounds).toHaveLength(10);
      expect(game.timePerRound).toBe(25);
      expect(game.engineVersion).toBe('v2');
      expect(new Set(involvedCountryIds).size).toBe(involvedCountryIds.length);
    }
  });

  it('each region appears exactly 2 times in duel', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const game = buildGeoChallengeDuelGame(seededRandom(seed));
      for (const region of ['AFRICA', 'AMERICAS', 'ASIA', 'EUROPE', 'OCEANIA']) {
        expect(game.rounds.filter((round) => round.region === region)).toHaveLength(2);
      }
    }
  });

  it('all 9 kinds appear at least once, exactly one appears twice', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const game = buildGeoChallengeDuelGame(seededRandom(seed));
      const kindCounts = new Map<string, number>();
      for (const round of game.rounds) {
        kindCounts.set(round.kind, (kindCounts.get(round.kind) || 0) + 1);
      }
      expect(kindCounts.size).toBe(9);
      const counts = [...kindCounts.values()].sort();
      expect(counts).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 2]);
    }
  });

  it('no consecutive same-kind rounds in duel', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const game = buildGeoChallengeDuelGame(seededRandom(seed));
      for (let i = 1; i < game.rounds.length; i += 1) {
        expect(game.rounds[i].kind).not.toBe(game.rounds[i - 1].kind);
      }
    }
  });

  it('200 deterministic duel seeds without failure', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const game = buildGeoChallengeDuelGame(seededRandom(seed));
      expect(game.rounds).toHaveLength(10);
    }
  });
});

describe('GeoRetos V2 scoring', () => {
  it('EASY = 100', () => {
    expect(getGeoChallengeBasePoints('EASY')).toBe(100);
  });

  it('MEDIUM = 125', () => {
    expect(getGeoChallengeBasePoints('MEDIUM')).toBe(125);
  });

  it('HARD = 150', () => {
    expect(getGeoChallengeBasePoints('HARD')).toBe(150);
  });

  it('undefined/V1 = 100', () => {
    expect(getGeoChallengeBasePoints(undefined)).toBe(100);
  });
});
