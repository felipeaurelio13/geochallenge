import { describe, it, expect } from 'vitest';

// Scoring utilities tests
describe('Scoring Utils', () => {
  const BASE_POINTS = 100;
  const MAX_TIME_BONUS = 50;
  const TIME_PER_QUESTION = 10;

  const calculateMultipleChoiceScore = (correct: boolean, timeRemaining: number): number => {
    if (!correct) return 0;
    const timeBonus = Math.round((timeRemaining / TIME_PER_QUESTION) * MAX_TIME_BONUS);
    return BASE_POINTS + timeBonus;
  };

  const calculateMapScore = (distanceKm: number, maxDistance: number = 500): number => {
    if (distanceKm >= maxDistance) return 0;
    const accuracy = 1 - distanceKm / maxDistance;
    return Math.round(BASE_POINTS * accuracy + MAX_TIME_BONUS * accuracy);
  };

  describe('calculateMultipleChoiceScore', () => {
    it('should return 0 for incorrect answers', () => {
      expect(calculateMultipleChoiceScore(false, 10)).toBe(0);
      expect(calculateMultipleChoiceScore(false, 5)).toBe(0);
      expect(calculateMultipleChoiceScore(false, 0)).toBe(0);
    });

    it('should return max points for correct answer with full time', () => {
      const score = calculateMultipleChoiceScore(true, 10);
      expect(score).toBe(BASE_POINTS + MAX_TIME_BONUS);
    });

    it('should return base points for correct answer with no time left', () => {
      const score = calculateMultipleChoiceScore(true, 0);
      expect(score).toBe(BASE_POINTS);
    });

    it('should return proportional bonus for partial time', () => {
      const score = calculateMultipleChoiceScore(true, 5);
      expect(score).toBe(BASE_POINTS + Math.round(MAX_TIME_BONUS / 2));
    });
  });

  describe('calculateMapScore', () => {
    it('should return 0 for distance >= maxDistance', () => {
      expect(calculateMapScore(500)).toBe(0);
      expect(calculateMapScore(1000)).toBe(0);
    });

    it('should return max points for exact location (0 km)', () => {
      const score = calculateMapScore(0);
      expect(score).toBe(BASE_POINTS + MAX_TIME_BONUS);
    });

    it('should return partial points for partial distance', () => {
      const score = calculateMapScore(250); // 50% accuracy
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(BASE_POINTS + MAX_TIME_BONUS);
    });
  });
});

// Haversine distance tests
describe('Haversine Distance', () => {
  const haversineDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  it('should return 0 for same coordinates', () => {
    expect(haversineDistance(0, 0, 0, 0)).toBe(0);
    expect(haversineDistance(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  it('should calculate distance between New York and Los Angeles (~3940 km)', () => {
    const nyLat = 40.7128;
    const nyLon = -74.006;
    const laLat = 34.0522;
    const laLon = -118.2437;
    const distance = haversineDistance(nyLat, nyLon, laLat, laLon);
    expect(distance).toBeGreaterThan(3900);
    expect(distance).toBeLessThan(4000);
  });

  it('should calculate distance between London and Paris (~344 km)', () => {
    const londonLat = 51.5074;
    const londonLon = -0.1278;
    const parisLat = 48.8566;
    const parisLon = 2.3522;
    const distance = haversineDistance(londonLat, londonLon, parisLat, parisLon);
    expect(distance).toBeGreaterThan(340);
    expect(distance).toBeLessThan(350);
  });
});

// Question generation tests
describe('Question Generation', () => {
  const shuffleArray = <T>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const getDistractors = (
    correctAnswer: string,
    allOptions: string[],
    count: number
  ): string[] => {
    const filtered = allOptions.filter((opt) => opt !== correctAnswer);
    return shuffleArray(filtered).slice(0, count);
  };

  it('should shuffle array without losing elements', () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(original);
    expect(shuffled).toHaveLength(original.length);
    expect(shuffled.sort()).toEqual(original.sort());
  });

  it('should get correct number of distractors', () => {
    const correct = 'France';
    const all = ['France', 'Germany', 'Italy', 'Spain', 'UK'];
    const distractors = getDistractors(correct, all, 3);
    expect(distractors).toHaveLength(3);
    expect(distractors).not.toContain(correct);
  });

  it('should not include correct answer in distractors', () => {
    const correct = 'France';
    const all = ['France', 'Germany', 'Italy', 'Spain', 'UK'];
    for (let i = 0; i < 10; i++) {
      const distractors = getDistractors(correct, all, 3);
      expect(distractors).not.toContain(correct);
    }
  });
});
