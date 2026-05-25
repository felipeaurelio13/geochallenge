import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Category, Difficulty } from '@prisma/client';

const { findManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
}));

vi.mock('../config/database.js', () => ({
  prisma: {
    question: {
      findMany: findManyMock,
    },
  },
}));

vi.mock('../utils/scoring.js', () => ({
  // Deterministas para que los tests sean predecibles.
  selectRandom: <T>(arr: T[], count: number) => arr.slice(0, count),
  shuffleArray: <T>(arr: T[]) => [...arr],
  calculateScore: () => 0,
  calculateMapScore: () => 0,
  calculateTimeBonus: () => 0,
  calculateRoundPoints: () => 0,
}));

import {
  buildFlagMasterRounds,
  getFlagMasterTierPlan,
  getTierConfigForRound,
  isSimilarTier,
  scoreFlagMasterAnswer,
} from '../services/flagMaster.service';

function makeQuestion(name: string, difficulty: Difficulty = Difficulty.HARD) {
  return {
    id: `q-${name}`,
    category: Category.FLAG,
    options: [name, 'Other1', 'Other2', 'Other3'],
    correctAnswer: name,
    difficulty,
    imageUrl: `https://flagcdn.com/w320/${name.toLowerCase()}.png`,
    questionData: name,
    continent: 'Europe',
  };
}

beforeEach(() => {
  findManyMock.mockReset();
});

describe('flagMaster.service - tier plan', () => {
  it('expone exactamente 10 rondas en orden', () => {
    const plan = getFlagMasterTierPlan();
    expect(plan).toHaveLength(10);
    expect(plan.map((p) => p.tier)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(plan.map((p) => p.modifier)).toEqual([
      'none',
      'none',
      'grayscale',
      'grayscale',
      'crop',
      'crop',
      'similar',
      'similar',
      'combined',
      'combined',
    ]);
  });

  it('multiplicadores escalan: warmup x1, mid x1.5, final x2.5', () => {
    const plan = getFlagMasterTierPlan();
    expect(plan[0].multiplier).toBe(1.0);
    expect(plan[1].multiplier).toBe(1.0);
    expect(plan[2].multiplier).toBe(1.5);
    expect(plan[3].multiplier).toBe(1.5);
    expect(plan[4].multiplier).toBe(1.5);
    expect(plan[5].multiplier).toBe(1.5);
    expect(plan[6].multiplier).toBe(1.5);
    expect(plan[7].multiplier).toBe(1.5);
    expect(plan[8].multiplier).toBe(2.5);
    expect(plan[9].multiplier).toBe(2.5);
  });

  it('getTierConfigForRound clampea fuera de rango (defensivo)', () => {
    expect(getTierConfigForRound(-5)).toEqual({ tier: 1, modifier: 'none', multiplier: 1.0 });
    expect(getTierConfigForRound(99)).toEqual({ tier: 5, modifier: 'combined', multiplier: 2.5 });
  });

  it('isSimilarTier identifica los tiers que usan distractores curados', () => {
    expect(isSimilarTier('none')).toBe(false);
    expect(isSimilarTier('grayscale')).toBe(false);
    expect(isSimilarTier('crop')).toBe(false);
    expect(isSimilarTier('similar')).toBe(true);
    expect(isSimilarTier('combined')).toBe(true);
  });
});

describe('flagMaster.service - getTierConfigForRound (degraded-path source of truth)', () => {
  it('cada índice 0-9 mapea al tier + multiplicador correctos', () => {
    const expected: Array<[number, number, string, number]> = [
      [0, 1, 'none', 1.0],
      [1, 1, 'none', 1.0],
      [2, 2, 'grayscale', 1.5],
      [3, 2, 'grayscale', 1.5],
      [4, 3, 'crop', 1.5],
      [5, 3, 'crop', 1.5],
      [6, 4, 'similar', 1.5],
      [7, 4, 'similar', 1.5],
      [8, 5, 'combined', 2.5],
      [9, 5, 'combined', 2.5],
    ];
    for (const [idx, tier, modifier, multiplier] of expected) {
      const cfg = getTierConfigForRound(idx);
      expect(cfg.tier).toBe(tier);
      expect(cfg.modifier).toBe(modifier);
      expect(cfg.multiplier).toBe(multiplier);
    }
  });
});

describe('flagMaster.service - scoreFlagMasterAnswer', () => {
  it('respuesta incorrecta = 0 puntos sin importar multiplicador', () => {
    const r = scoreFlagMasterAnswer(false, 5, 2.5, 100, 50, 10);
    expect(r).toEqual({ basePoints: 0, timeBonus: 0, modifierBonus: 0, points: 0 });
  });

  it('respuesta correcta con multiplicador 1.0 = base + timeBonus (sin modifierBonus)', () => {
    // timeRemaining=10 (max) → timeBonus=50; raw=150; points=150; modifierBonus=0
    const r = scoreFlagMasterAnswer(true, 10, 1.0, 100, 50, 10);
    expect(r.basePoints).toBe(100);
    expect(r.timeBonus).toBe(50);
    expect(r.points).toBe(150);
    expect(r.modifierBonus).toBe(0);
  });

  it('respuesta correcta con multiplicador 2.5 escala el total y el modifierBonus refleja la diferencia', () => {
    // timeRemaining=5 → timeBonus=25; raw=125; points=313 (Math.round(125*2.5)); modifierBonus=188
    const r = scoreFlagMasterAnswer(true, 5, 2.5, 100, 50, 10);
    expect(r.basePoints).toBe(100);
    expect(r.timeBonus).toBe(25);
    expect(r.points).toBe(313);
    expect(r.modifierBonus).toBe(188);
  });

  it('clampea timeRemaining negativo a 0 (no inflar score con valores raros)', () => {
    const r = scoreFlagMasterAnswer(true, -3, 1.5, 100, 50, 10);
    expect(r.timeBonus).toBe(0);
    expect(r.points).toBe(150);
  });

  it('clampea timeRemaining > timePerQuestion al máximo', () => {
    const r = scoreFlagMasterAnswer(true, 99, 1.0, 100, 50, 10);
    expect(r.timeBonus).toBe(50);
  });
});

describe('flagMaster.service - buildFlagMasterRounds', () => {
  it('rechaza si la pool tiene menos de 10 banderas disponibles', async () => {
    findManyMock.mockResolvedValueOnce([]); // HARD vacío
    findManyMock.mockResolvedValueOnce([]); // MEDIUM vacío
    await expect(buildFlagMasterRounds()).rejects.toThrow(/al menos 10/);
  });

  it('arma 10 rondas con los modifiers del plan, en orden', async () => {
    const hard = [
      'Russia',
      'Croatia',
      'Egypt',
      'Sudan',
      'Italy',
      'Mexico',
      'Indonesia',
      'Monaco',
      'Norway',
      'Sweden',
      'Romania',
      'Chad',
    ].map((c) => makeQuestion(c, Difficulty.HARD));

    findManyMock.mockResolvedValueOnce(hard);

    const rounds = await buildFlagMasterRounds();

    expect(rounds).toHaveLength(10);
    expect(rounds.map((r) => r.flagModifier)).toEqual([
      'none',
      'none',
      'grayscale',
      'grayscale',
      'crop',
      'crop',
      'similar',
      'similar',
      'combined',
      'combined',
    ]);
    expect(rounds.map((r) => r.tier)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it('en tiers "similar" + "combined", elige preguntas con grupo de similitud y agrega groupId', async () => {
    // Mezcla deliberada: una pregunta SIN grupo (Vatican no está en mis grupos)
    // y varias CON grupo. El service debe elegir las que están en grupo para los tiers 4-5.
    const hard = [
      makeQuestion('Vatican City'), // sin grupo
      makeQuestion('Bhutan'),       // sin grupo
      makeQuestion('Russia'),       // pan_slavic_horiz
      makeQuestion('Croatia'),      // pan_slavic_horiz
      makeQuestion('Slovakia'),     // pan_slavic_horiz
      makeQuestion('Serbia'),       // pan_slavic_horiz
      makeQuestion('Slovenia'),     // pan_slavic_horiz
      makeQuestion('Egypt'),        // pan_arab_red_white_black
      makeQuestion('Syria'),        // pan_arab_red_white_black
      makeQuestion('Iraq'),         // pan_arab_red_white_black
      makeQuestion('Yemen'),        // pan_arab_red_white_black
      makeQuestion('Sudan'),        // pan_arab_red_white_black
    ];

    findManyMock.mockResolvedValueOnce(hard);
    const rounds = await buildFlagMasterRounds();

    // Las rondas 7-10 (índices 6-9) son tiers similar/combined: deben tener groupId.
    const similarRounds = rounds.slice(6, 10);
    for (const r of similarRounds) {
      expect(r.similarityGroupId).toBeDefined();
    }
    // Y el correctAnswer de esas rondas debe estar en algún grupo.
    const inGroupCountries = new Set([
      'Russia', 'Croatia', 'Slovakia', 'Serbia', 'Slovenia',
      'Egypt', 'Syria', 'Iraq', 'Yemen', 'Sudan',
    ]);
    for (const r of similarRounds) {
      expect(inGroupCountries.has(r.correctAnswer)).toBe(true);
    }
  });

  it('en tiers similar, las 4 opciones deben pertenecer al mismo grupo cuando es posible', async () => {
    const hard = [
      makeQuestion('Russia'),
      makeQuestion('Croatia'),
      makeQuestion('Slovakia'),
      makeQuestion('Serbia'),
      makeQuestion('Slovenia'),
      makeQuestion('Egypt'),
      makeQuestion('Syria'),
      makeQuestion('Iraq'),
      makeQuestion('Yemen'),
      makeQuestion('Sudan'),
    ];

    findManyMock.mockResolvedValueOnce(hard);
    const rounds = await buildFlagMasterRounds();

    const slavic = new Set(['Russia', 'Croatia', 'Slovakia', 'Serbia', 'Slovenia']);
    const arab = new Set(['Egypt', 'Syria', 'Iraq', 'Yemen', 'Sudan']);

    for (const r of rounds.slice(6, 10)) {
      const inSlavic = r.options.every((o) => slavic.has(o));
      const inArab = r.options.every((o) => arab.has(o));
      expect(inSlavic || inArab).toBe(true);
    }
  });

  it('completa la pool con MEDIUM si HARD tiene menos de 10 preguntas', async () => {
    const hardOnly = [makeQuestion('Russia'), makeQuestion('Croatia')];
    const medium = Array.from({ length: 10 }, (_, i) =>
      makeQuestion(`Medium${i}`, Difficulty.MEDIUM)
    );

    findManyMock.mockResolvedValueOnce(hardOnly);
    findManyMock.mockResolvedValueOnce(medium);

    const rounds = await buildFlagMasterRounds();
    expect(rounds).toHaveLength(10);
    expect(findManyMock).toHaveBeenCalledTimes(2);
  });

  it('regresión: si Andorra está en HARD pero Romania/Chad/Moldova no, aún devuelve grupo (los distractores son sólo nombres, no requieren su propia Question)', async () => {
    // Reproduce el bug observado en producción el 2026-05-25: Andorra estaba
    // en la pool HARD pero el resto de blue_yellow_red_vert (Romania/Chad/
    // Moldova) no aparecían como Question en HARD, así que buildSimilarOptions
    // descartaba el grupo y caía a opciones genéricas. Los distractores son
    // sólo strings: no necesitan tener una Question propia para mostrarse.
    const hard = [
      makeQuestion('Andorra'),
      ...Array.from({ length: 11 }, (_, i) => makeQuestion(`Filler${i}`)),
    ];

    findManyMock.mockResolvedValueOnce(hard);
    const rounds = await buildFlagMasterRounds();

    const andorraRound = rounds.find((r) => r.correctAnswer === 'Andorra');
    expect(andorraRound).toBeDefined();
    // Andorra DEBE caer en tier 4 o 5 (es el único país con grupo en el pool)
    expect([4, 5]).toContain(andorraRound!.tier);
    expect(andorraRound!.similarityGroupId).toBe('blue_yellow_red_vert');
    // Las opciones deben ser del grupo: Andorra + 3 de {Romania, Chad, Moldova}
    const groupSet = new Set(['Andorra', 'Romania', 'Chad', 'Moldova']);
    for (const opt of andorraRound!.options) {
      expect(groupSet.has(opt)).toBe(true);
    }
  });
});
