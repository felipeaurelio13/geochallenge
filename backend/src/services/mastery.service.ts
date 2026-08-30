import { Prisma, Category, GameMode, GameVariant, Difficulty } from '@prisma/client';
import { prisma } from '../config/database.js';
import { loadCountryCatalog, getActiveCountries, type CountryRecord } from '../utils/countryCatalog.js';

export type MasteryLevel = 'UNSEEN' | 'LEARNING' | 'FAMILIAR' | 'STRONG' | 'MASTERED';

export interface MasteryScoreResult {
  attempts: number;
  correct: number;
  accuracy: number;
  evidence: number;
  masteryScore: number;
  level: MasteryLevel;
}

export interface SkillMastery {
  category: Category;
  availableQuestions: number;
  attempts: number;
  correct: number;
  accuracy: number;
  masteryScore: number;
  level: MasteryLevel;
  lastIncorrect?: boolean;
  lastSeenAt?: number;
}

export interface CountryMastery {
  countryCode: string;
  name: string;
  continent: string;
  stamped: boolean;
  mastered: boolean;
  score: number;
  attempts: number;
  correct: number;
  skills: SkillMastery[];
}

export interface MasterySummary {
  worldProgressPercent: number;
  totalCountries: number;
  stampedCountries: number;
  masteredCountries: number;
  skills: {
    category: Category;
    attempts: number;
    correct: number;
    accuracy: number;
    masteryScore: number;
  }[];
}

export function calculateWorldProgressPercent(stampedCountries: number, totalCountries: number): number {
  return totalCountries > 0
    ? parseFloat(((stampedCountries / totalCountries) * 100).toFixed(1))
    : 0;
}

interface AttemptsForCountry {
  [countryCode: string]: { [category: string]: { attempts: number; correct: number; lastIncorrect?: boolean; lastSeenAt?: number } };
}

export function calculateMasteryScore(
  attempts: number,
  correct: number
): MasteryScoreResult {
  const accuracy = attempts > 0 ? correct / attempts : 0;
  const evidence = Math.min(attempts / 8, 1);
  const masteryScore = Math.round(100 * accuracy * evidence);

  let level: MasteryLevel;
  if (attempts === 0) {
    level = 'UNSEEN';
  } else if (masteryScore < 40) {
    level = 'LEARNING';
  } else if (masteryScore < 60) {
    level = 'FAMILIAR';
  } else if (masteryScore < 80) {
    level = 'STRONG';
  } else {
    level = 'MASTERED';
  }

  return {
    attempts,
    correct,
    accuracy,
    evidence,
    masteryScore,
    level,
  };
}

export function getMasteryLevel(score: MasteryScoreResult): MasteryLevel {
  return score.level;
}

export async function applyMasteryAttemptsForRun(
  tx: Prisma.TransactionClient,
  userId: string,
  runId: string,
  gameMode: GameMode,
  variant: GameVariant,
  answers: { questionId: string; isCorrect: boolean }[]
): Promise<void> {
  if (answers.length === 0) return;

  const questionIds = answers.map((a) => a.questionId);
  const questions = await tx.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, countryCode: true, category: true, difficulty: true },
  });

  const questionMap = new Map(questions.map((q) => [q.id, q]));

  const attempts = answers
    .map((a) => {
      const q = questionMap.get(a.questionId);
      if (!q || !q.countryCode || q.category === Category.MIXED) return null;
      return {
        userId,
        runId,
        questionId: a.questionId,
        countryCode: q.countryCode,
        category: q.category,
        difficulty: q.difficulty,
        isCorrect: a.isCorrect,
        gameMode,
        variant,
      };
    })
    .filter(Boolean) as Prisma.MasteryAttemptCreateManyInput[];

  if (attempts.length === 0) return;

  await tx.masteryAttempt.createMany({
    data: attempts,
    skipDuplicates: true,
  });
}

async function getMasteryAttempts(userId: string): Promise<AttemptsForCountry> {
  const attempts = await prisma.masteryAttempt.findMany({
    where: { userId },
    select: {
      countryCode: true,
      category: true,
      isCorrect: true,
      occurredAt: true,
    },
    orderBy: { occurredAt: 'asc' },
  });

  const result: AttemptsForCountry = {};
  for (const a of attempts) {
    if (!result[a.countryCode]) result[a.countryCode] = {};
    if (!result[a.countryCode][a.category]) {
      result[a.countryCode][a.category] = { attempts: 0, correct: 0 };
    }
    result[a.countryCode][a.category].attempts++;
    if (a.isCorrect) result[a.countryCode][a.category].correct++;
    result[a.countryCode][a.category].lastSeenAt = a.occurredAt.getTime();
    if (!a.isCorrect) result[a.countryCode][a.category].lastIncorrect = true;
    else result[a.countryCode][a.category].lastIncorrect = false;
  }

  return result;
}

async function getAvailableSkillsByCountry(): Promise<Map<string, Map<Category, number>>> {
  const questions = await prisma.question.findMany({
    where: { isAvailable: true, countryCode: { not: null } },
    select: { countryCode: true, category: true },
  });

  const result = new Map<string, Map<Category, number>>();
  for (const q of questions) {
    if (!q.countryCode) continue;
    if (!result.has(q.countryCode)) result.set(q.countryCode, new Map());
    const skills = result.get(q.countryCode)!;
    skills.set(q.category as Category, (skills.get(q.category as Category) ?? 0) + 1);
  }

  return result;
}

export async function getMasterySummary(userId: string): Promise<MasterySummary> {
  const attempts = await getMasteryAttempts(userId);
  const availableSkills = await getAvailableSkillsByCountry();

  const playableCountryCodes = new Set(availableSkills.keys());

  const countryCatalog = getActiveCountries(loadCountryCatalog());
  const catalogByCode = new Map(countryCatalog.map((c) => [c.iso2, c]));

  let stampedCountries = 0;
  let masteredCountries = 0;

  const skillAgg: Record<string, { attempts: number; correct: number }> = {};

  for (const countryCode of playableCountryCodes) {
    const countryAttempts = attempts[countryCode] ?? {};
    let totalCorrect = 0;
    let skillsWithAttempts = 0;

    const availableSkillsForCountry = availableSkills.get(countryCode) ?? new Map();

    for (const [cat, available] of availableSkillsForCountry) {
      const key = cat as Category;
      if (available === 0) continue;
      const stats = countryAttempts[key] ?? { attempts: 0, correct: 0 };
      const score = calculateMasteryScore(stats.attempts, stats.correct);

      if (!skillAgg[key]) skillAgg[key] = { attempts: 0, correct: 0 };
      skillAgg[key].attempts += stats.attempts;
      skillAgg[key].correct += stats.correct;

      skillsWithAttempts++;
      totalCorrect += stats.correct;
    }

    if (skillsWithAttempts === 0) continue;

    if (totalCorrect > 0) stampedCountries++;

    const scores = [...availableSkillsForCountry.entries()].map(([cat]) => {
      const stats = countryAttempts[cat] ?? { attempts: 0, correct: 0 };
      return calculateMasteryScore(stats.attempts, stats.correct).masteryScore;
    });

    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    if (avgScore >= 80) masteredCountries++;
  }

  const totalCountries = playableCountryCodes.size;
  const worldProgressPercent = calculateWorldProgressPercent(stampedCountries, totalCountries);

  const skills = Object.entries(skillAgg).map(([category, stats]) => {
    const score = calculateMasteryScore(stats.attempts, stats.correct);
    return {
      category: category as Category,
      attempts: stats.attempts,
      correct: stats.correct,
      accuracy: score.accuracy,
      masteryScore: score.masteryScore,
    };
  });

  return {
    worldProgressPercent,
    totalCountries,
    stampedCountries,
    masteredCountries,
    skills,
  };
}

export async function getPassport(userId: string): Promise<CountryMastery[]> {
  const attempts = await getMasteryAttempts(userId);
  const availableSkills = await getAvailableSkillsByCountry();

  const countryCatalog = getActiveCountries(loadCountryCatalog());
  const catalogByCode = new Map(countryCatalog.map((c) => [c.iso2, c]));

  const playableCountryCodes = new Set(availableSkills.keys());
  const result: CountryMastery[] = [];

  for (const countryCode of playableCountryCodes) {
    const country = catalogByCode.get(countryCode);
    if (!country) continue;

    const countryAttempts = attempts[countryCode] ?? {};
    const availableSkillsForCountry = availableSkills.get(countryCode) ?? new Map();

    let totalAttempts = 0;
    let totalCorrect = 0;
    const skills: SkillMastery[] = [];

    for (const [cat, available] of availableSkillsForCountry) {
      const category = cat as Category;
      if (available === 0) continue;
      const stats = countryAttempts[category] ?? { attempts: 0, correct: 0 };
      const score = calculateMasteryScore(stats.attempts, stats.correct);

      totalAttempts += stats.attempts;
      totalCorrect += stats.correct;

      skills.push({
        category,
        availableQuestions: available,
        attempts: stats.attempts,
        correct: stats.correct,
        accuracy: score.accuracy,
        masteryScore: score.masteryScore,
        level: score.level,
        lastIncorrect: stats.lastIncorrect,
        lastSeenAt: stats.lastSeenAt,
      });
    }

    if (skills.length === 0) continue;

    const avgScore = skills.length > 0
      ? skills.reduce((a, b) => a + b.masteryScore, 0) / skills.length
      : 0;

    result.push({
      countryCode: country.iso2,
      name: country.name,
      continent: country.continent,
      stamped: totalCorrect > 0,
      mastered: avgScore >= 80,
      score: parseFloat(avgScore.toFixed(1)),
      attempts: totalAttempts,
      correct: totalCorrect,
      skills,
    });
  }

  result.sort((a, b) => b.score - a.score);

  return result;
}

interface CandidateQuestion {
  questionId: string;
  countryCode: string;
  category: Category;
  difficulty: Difficulty | null;
  masteryScore: number;
  priority: number;
}

export async function selectAdaptivePracticeQuestions(
  userId: string,
  count: number = 10,
  focusCountryCode?: string
): Promise<string[]> {
  const effectiveCount = Math.max(1, Math.min(count, 20));

  const attempts = await getMasteryAttempts(userId);

  const questionWhere = focusCountryCode
    ? { isAvailable: true, countryCode: focusCountryCode }
    : { isAvailable: true, countryCode: { not: null } };

  const questions = await prisma.question.findMany({
    where: questionWhere,
    select: { id: true, countryCode: true, category: true, difficulty: true },
  });

  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const recentAttempts = await prisma.masteryAttempt.findMany({
    where: {
      userId,
      occurredAt: { gte: new Date(now - ONE_DAY_MS) },
    },
    select: { questionId: true, occurredAt: true },
  });
  const recentQuestionSeenAt = new Map<string, number>();
  for (const a of recentAttempts) {
    const existing = recentQuestionSeenAt.get(a.questionId);
    if (!existing || a.occurredAt.getTime() > existing) {
      recentQuestionSeenAt.set(a.questionId, a.occurredAt.getTime());
    }
  }

  const candidates: CandidateQuestion[] = questions
    .filter((q) => q.countryCode)
    .map((q) => {
      const countryStats = attempts[q.countryCode!] ?? {};
      const skillStats = countryStats[q.category] ?? { attempts: 0, correct: 0, lastIncorrect: undefined, lastSeenAt: undefined };
      const score = calculateMasteryScore(skillStats.attempts, skillStats.correct);
      let priority = 100 - score.masteryScore;

      if (skillStats.lastIncorrect) priority += 35;
      if (skillStats.attempts === 0) priority += 15;

      const lastQuestionSeenAt = recentQuestionSeenAt.get(q.id);
      if (lastQuestionSeenAt && (now - lastQuestionSeenAt) < ONE_DAY_MS) priority -= 40;

      priority += Math.random() * 5;

      return {
        questionId: q.id,
        countryCode: q.countryCode!,
        category: q.category as Category,
        difficulty: q.difficulty,
        masteryScore: score.masteryScore,
        priority,
      };
    });

  candidates.sort((a, b) => b.priority - a.priority);

  const selected: string[] = [];
  const usedCountryCodes = new Map<string, number>();
  const usedCategories = new Map<Category, number>();
  const maxPerCountry = 2;
  const maxPerCategory = Math.ceil(effectiveCount / 2);

  for (const c of candidates) {
    if (selected.length >= effectiveCount) break;

    const countryCount = usedCountryCodes.get(c.countryCode) ?? 0;
    const categoryCount = usedCategories.get(c.category) ?? 0;

    if (countryCount >= maxPerCountry || categoryCount >= maxPerCategory) continue;

    selected.push(c.questionId);
    usedCountryCodes.set(c.countryCode, countryCount + 1);
    usedCategories.set(c.category, categoryCount + 1);
  }

  if (selected.length < effectiveCount) {
    const selectedSet = new Set(selected);
    for (const c of candidates) {
      if (selected.length >= effectiveCount) break;
      if (selectedSet.has(c.questionId)) continue;
      selected.push(c.questionId);
      selectedSet.add(c.questionId);
    }
  }

  return selected;
}
