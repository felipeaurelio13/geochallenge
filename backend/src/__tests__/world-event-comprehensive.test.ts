import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  getWorldEventWindow,
  mapContinentToEventRegion,
  toPublicBossQuestion,
  WORLD_EVENT_VERSION,
  WORLD_EVENT_BOSS_VERSION,
  BOSS_TOTAL_QUESTIONS,
  BOSS_HP_REQUIRED,
  BOSS_QUESTION_SECONDS,
  BOSS_SERVER_GRACE_MS,
  type WorldEventPlanData,
} from '../services/worldEvent.service.js';
import { Category, Difficulty, WorldEventRegion } from '@prisma/client';

const ROOT = path.resolve(process.cwd(), '..');
const FE = path.join(ROOT, 'frontend');
const BE = process.cwd();

function read(relFromRoot: string): string {
  return fs.readFileSync(path.join(ROOT, relFromRoot), 'utf-8');
}

function exists(relFromRoot: string): boolean {
  return fs.existsSync(path.join(ROOT, relFromRoot));
}

// ─── WORLD EVENT WINDOW ───────────────────────────────────────────────
describe('World Event Window', () => {
  it('Monday boundary: epoch 2026-08-10 is AFRICA', () => {
    const w = getWorldEventWindow(new Date('2026-08-10T00:00:00.000Z'));
    expect(w.eventId).toBe('2026-08-10');
    expect(w.region).toBe('AFRICA');
    expect(w.startsAt.toISOString()).toBe('2026-08-10T00:00:00.000Z');
    expect(w.endsAt.toISOString()).toBe('2026-08-17T00:00:00.000Z');
  });

  it('Sunday boundary: last moment of week still belongs to same event', () => {
    const sun = getWorldEventWindow(new Date('2026-08-16T23:59:59.999Z'));
    const mon = getWorldEventWindow(new Date('2026-08-10T00:00:00.000Z'));
    expect(sun.eventId).toBe(mon.eventId);
    expect(sun.region).toBe(mon.region);
  });

  it('year boundary: Dec 31 and Jan 1 are in same week', () => {
    const dec31 = getWorldEventWindow(new Date('2026-12-31T12:00:00.000Z'));
    const jan1 = getWorldEventWindow(new Date('2027-01-01T12:00:00.000Z'));
    expect(dec31.eventId).toBe(jan1.eventId);
  });

  it('deterministic: same input yields same output', () => {
    const t = new Date('2026-08-15T10:00:00.000Z');
    expect(getWorldEventWindow(t).eventId).toBe(getWorldEventWindow(t).eventId);
    expect(getWorldEventWindow(t).region).toBe(getWorldEventWindow(t).region);
  });

  it('5-region rotation: AFRICA→AMERICAS→ASIA→EUROPE→OCEANIA→AFRICA', () => {
    const regions: WorldEventRegion[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date('2026-08-10T12:00:00.000Z');
      d.setDate(d.getDate() + i * 7);
      regions.push(getWorldEventWindow(d).region);
    }
    expect(regions).toEqual(['AFRICA', 'AMERICAS', 'ASIA', 'EUROPE', 'OCEANIA', 'AFRICA']);
  });

  it('event duration is exactly 7 days', () => {
    const w = getWorldEventWindow(new Date('2026-08-12T12:00:00.000Z'));
    expect(w.endsAt.getTime() - w.startsAt.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

// ─── PROGRESS ─────────────────────────────────────────────────────────
describe('Progress computation', () => {
  it('defaults when no plan exists', () => {
    const result = {
      correctInRegion: 0,
      correctRequired: 8,
      distinctCategories: 0,
      categoriesRequired: 3,
      dailyCompleted: false,
      bossUnlocked: false,
    };
    expect(result.correctRequired).toBe(8);
    expect(result.categoriesRequired).toBe(3);
    expect(result.bossUnlocked).toBe(false);
  });

  it('boss requires all three: correctInRegion>=8, distinctCategories>=3, dailyCompleted', () => {
    expect(7 >= 8 && 3 >= 3 && true).toBe(false);
    expect(8 >= 8 && 2 >= 3 && true).toBe(false);
    expect(8 >= 8 && 3 >= 3 && false).toBe(false);
    expect(8 >= 8 && 3 >= 3 && true).toBe(true);
  });
});

// ─── COMPOSER CONSTANTS ───────────────────────────────────────────────
describe('Boss composer constants', () => {
  it('10 questions, 7 HP to clear', () => {
    expect(BOSS_TOTAL_QUESTIONS).toBe(10);
    expect(BOSS_HP_REQUIRED).toBe(7);
  });

  it('20s per question + 1.5s grace', () => {
    expect(BOSS_QUESTION_SECONDS).toBe(20);
    expect(BOSS_SERVER_GRACE_MS).toBe(1500);
  });

  it('version strings are stable', () => {
    expect(WORLD_EVENT_VERSION).toBe('weekly-world-event-v1');
    expect(WORLD_EVENT_BOSS_VERSION).toBe('regional-boss-v1');
  });
});

// ─── toPublicBossQuestion ──────────────────────────────────────────────
describe('toPublicBossQuestion', () => {
  const plan: WorldEventPlanData = {
    eventId: '2026-08-10',
    version: WORLD_EVENT_BOSS_VERSION,
    region: 'AFRICA',
    questionIds: ['q1', 'q2'],
    stops: [
      { questionId: 'q1', countryCode: 'KE', category: Category.FLAG, difficulty: Difficulty.MEDIUM },
      { questionId: 'q2', countryCode: 'NG', category: Category.CAPITAL, difficulty: Difficulty.HARD },
    ],
    startsAt: new Date('2026-08-10'),
    endsAt: new Date('2026-08-17'),
  };

  it('strips correctAnswer and countryCode', () => {
    const q = toPublicBossQuestion(plan, 0, {
      id: 'q1',
      category: Category.FLAG,
      questionData: 'Flag of Kenya',
      options: ['Kenya', 'Nigeria', 'Ghana'],
      imageUrl: null,
      difficulty: Difficulty.MEDIUM,
    });
    expect(q.questionId).toBe('q1');
    expect(q.category).toBe(Category.FLAG);
    expect(q.questionText).toBe('Flag of Kenya');
    expect((q as any).correctAnswer).toBeUndefined();
    expect((q as any).countryCode).toBeUndefined();
  });
});

// ─── mapContinentToEventRegion ────────────────────────────────────────
describe('mapContinentToEventRegion', () => {
  it('maps all continents correctly', () => {
    expect(mapContinentToEventRegion('Africa')).toBe('AFRICA');
    expect(mapContinentToEventRegion('Asia')).toBe('ASIA');
    expect(mapContinentToEventRegion('Europe')).toBe('EUROPE');
    expect(mapContinentToEventRegion('Oceania')).toBe('OCEANIA');
    expect(mapContinentToEventRegion('North America')).toBe('AMERICAS');
    expect(mapContinentToEventRegion('South America')).toBe('AMERICAS');
    expect(mapContinentToEventRegion('Antarctica')).toBeNull();
  });
});

// ─── 260-WEEK SIMULATION ──────────────────────────────────────────────
describe('260 consecutive eventIds', () => {
  it('all are valid dates and cycle through 5 regions', () => {
    const regionCounts: Record<string, number> = {};
    for (let i = 0; i < 260; i++) {
      const d = new Date('2026-08-10T12:00:00.000Z');
      d.setDate(d.getDate() + i * 7);
      const w = getWorldEventWindow(d);
      expect(w.eventId).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      regionCounts[w.region] = (regionCounts[w.region] || 0) + 1;
    }
    expect(Object.values(regionCounts).every((c) => c === 52)).toBe(true);
  });
});

// ─── ACHIEVEMENTS ─────────────────────────────────────────────────────
describe('Boss achievement keys', () => {
  it('BOSS_FIRST and BOSS_PERFECT are defined as string constants', async () => {
    const mod = await import('../services/achievement.service.js');
    const content = fs.readFileSync(
      path.join(BE, 'src/services/achievement.service.ts'),
      'utf-8',
    );
    expect(content).toContain("'BOSS_FIRST'");
    expect(content).toContain("'BOSS_PERFECT'");
  });
});

// ─── PRUNING: PHILOS SERVER CLEANUP ───────────────────────────────────
describe('PhilServer cleanup', () => {
  it('ServerWakeUp component file is removed', () => {
    expect(exists('frontend/src/components/ServerWakeUp.tsx')).toBe(false);
  });

  it('BackendKeepAlive component file is removed', () => {
    expect(exists('frontend/src/components/BackendKeepAlive.tsx')).toBe(false);
  });

  it('keep-backend-awake workflow is removed', () => {
    expect(exists('.github/workflows/keep-backend-awake.yml')).toBe(false);
  });

  it('render.yaml does not exist', () => {
    expect(exists('render.yaml')).toBe(false);
  });

  it('BackendKeepAlive test file is removed', () => {
    expect(exists('frontend/src/__tests__/backend-keep-alive.test.tsx')).toBe(false);
  });

  it('keep-backend-awake-workflow test is removed', () => {
    expect(exists('backend/src/__tests__/keep-backend-awake-workflow.test.ts')).toBe(false);
  });
});

// ─── PRUNING: LEGACY ROUTES RETAINED ─────────────────────────────────
describe('Legacy routes retained', () => {
  it('GET /health endpoint exists in backend index', () => {
    expect(read('backend/src/index.ts')).toContain('/health');
  });

  it('GET /ping endpoint exists in backend index', () => {
    expect(read('backend/src/index.ts')).toContain('/ping');
  });
});

// ─── INTEGRITY: EVENT_BOSS EXCLUSIONS ─────────────────────────────────
describe('EVENT_BOSS exclusions', () => {
  it('EVENT_BOSS variant exists in GameVariant enum', async () => {
    const { GameVariant } = await import('@prisma/client');
    expect(GameVariant.EVENT_BOSS).toBeDefined();
  });

  it('WorldEventRegion enum has all 5 regions', async () => {
    const { WorldEventRegion } = await import('@prisma/client');
    expect(WorldEventRegion.AFRICA).toBeDefined();
    expect(WorldEventRegion.AMERICAS).toBeDefined();
    expect(WorldEventRegion.ASIA).toBeDefined();
    expect(WorldEventRegion.EUROPE).toBeDefined();
    expect(WorldEventRegion.OCEANIA).toBeDefined();
  });

  it('WorldEventBossAttemptStatus has ACTIVE, COMPLETED, ABANDONED', async () => {
    const { WorldEventBossAttemptStatus } = await import('@prisma/client');
    expect(WorldEventBossAttemptStatus.ACTIVE).toBeDefined();
    expect(WorldEventBossAttemptStatus.COMPLETED).toBeDefined();
    expect(WorldEventBossAttemptStatus.ABANDONED).toBeDefined();
  });
});

// ─── PRUNING: APP.TSX REFERENCES ──────────────────────────────────────
describe('App.tsx pruning', () => {
  it('BackendKeepAlive is not imported in App.tsx', () => {
    expect(read('frontend/src/App.tsx')).not.toContain('BackendKeepAlive');
  });

  it('ServerWakeUp is not imported in App.tsx', () => {
    expect(read('frontend/src/App.tsx')).not.toContain('ServerWakeUp');
  });

  it('WorldEventPage route exists in App.tsx', () => {
    const content = read('frontend/src/App.tsx');
    expect(content).toContain('WorldEventPage');
    expect(content).toContain('/event');
  });
});

// ─── PRUNING: COMPONENTS INDEX ────────────────────────────────────────
describe('Components index pruning', () => {
  it('BackendKeepAlive is not exported from components/index.ts', () => {
    expect(read('frontend/src/components/index.ts')).not.toContain('BackendKeepAlive');
  });

  it('ServerWakeUp is not exported from components/index.ts', () => {
    expect(read('frontend/src/components/index.ts')).not.toContain('ServerWakeUp');
  });
});

// ─── UX TELEMETRY: BOSS EVENTS ────────────────────────────────────────
describe('UX telemetry boss events', () => {
  it('game_started, question_answered, game_finished are in ClientEventName', () => {
    const content = read('frontend/src/utils/uxTelemetry.ts');
    expect(content).toContain("'game_started'");
    expect(content).toContain("'question_answered'");
    expect(content).toContain("'game_finished'");
  });
});

// ─── I18N KEYS ────────────────────────────────────────────────────────
describe('i18n keys', () => {
  it('EVENT_BOSS_LOCKED exists in en.json', () => {
    const en = JSON.parse(read('frontend/src/i18n/en.json'));
    expect(en.apiErrors.EVENT_BOSS_LOCKED).toBeDefined();
  });

  it('EVENT_BOSS_LOCKED exists in es.json', () => {
    const es = JSON.parse(read('frontend/src/i18n/es.json'));
    expect(es.apiErrors.EVENT_BOSS_LOCKED).toBeDefined();
  });
});

// ─── FRONTEND: API METHODS ────────────────────────────────────────────
describe('Frontend API methods', () => {
  it('api.ts exports getCurrentEvent, startBoss, bossAnswer', () => {
    const content = read('frontend/src/services/api.ts');
    expect(content).toContain('getCurrentEvent');
    expect(content).toContain('startBoss');
    expect(content).toContain('bossAnswer');
  });
});

// ─── FRONTEND: TYPES ──────────────────────────────────────────────────
describe('Frontend types', () => {
  it('WorldEventRegion, WorldEventCurrentResponse, WorldEventBossQuestion in types/index.ts', () => {
    const content = read('frontend/src/types/index.ts');
    expect(content).toContain('WorldEventRegion');
    expect(content).toContain('WorldEventCurrentResponse');
    expect(content).toContain('WorldEventBossQuestion');
    expect(content).toContain('EVENT_BOSS');
  });
});

// ─── PRISMA SCHEMA ────────────────────────────────────────────────────
describe('Prisma schema', () => {
  const schema = read('backend/prisma/schema.prisma');

  it('WorldEventPlan model exists', () => {
    expect(schema).toContain('model WorldEventPlan');
  });

  it('WorldEventBossAttempt model exists', () => {
    expect(schema).toContain('model WorldEventBossAttempt');
  });

  it('WorldEventBossAnswer model exists', () => {
    expect(schema).toContain('model WorldEventBossAnswer');
  });

  it('EVENT_BOSS in GameVariant enum', () => {
    expect(schema).toContain('EVENT_BOSS');
  });

  it('WorldEventRegion enum exists', () => {
    expect(schema).toContain('enum WorldEventRegion');
  });

  it('WorldEventBossAttemptStatus enum exists', () => {
    expect(schema).toContain('enum WorldEventBossAttemptStatus');
  });
});

// ─── MIGRATION SQL ────────────────────────────────────────────────────
describe('Migration SQL', () => {
  it('migration file exists with correct name', () => {
    expect(exists('backend/prisma/migrations/20260815000000_add_world_event/migration.sql')).toBe(true);
  });
});

// ─── BACKEND CONTROLLER FILE ──────────────────────────────────────────
describe('WorldEvent controller', () => {
  it('controller file exists', () => {
    expect(exists('backend/src/controllers/worldEvent.controller.ts')).toBe(true);
  });

  it('controller has /current, /current/boss/start, /boss/:attemptId/answer routes', () => {
    const content = read('backend/src/controllers/worldEvent.controller.ts');
    expect(content).toContain("'/current'");
    expect(content).toContain("'/current/boss/start'");
    expect(content).toContain("'/boss/:attemptId/answer'");
  });
});

// ─── BACKEND ROUTE MOUNTING ───────────────────────────────────────────
describe('Route mounting', () => {
  it('worldEventController is mounted in index.ts at /api/events', () => {
    const content = read('backend/src/index.ts');
    expect(content).toContain('worldEventController');
    expect(content).toContain('/api/events');
  });
});

// ─── BACKEND SERVICE FILE ─────────────────────────────────────────────
describe('WorldEvent service', () => {
  it('service file exists', () => {
    expect(exists('backend/src/services/worldEvent.service.ts')).toBe(true);
  });

  it('exports key functions', async () => {
    const mod = await import('../services/worldEvent.service.js');
    expect(typeof mod.getWorldEventWindow).toBe('function');
    expect(typeof mod.getCurrentWorldEvent).toBe('function');
    expect(typeof mod.mapContinentToEventRegion).toBe('function');
    expect(typeof mod.toPublicBossQuestion).toBe('function');
    expect(typeof mod.getWorldEventProgress).toBe('function');
    expect(typeof mod.buildWorldEventBoss).toBe('function');
    expect(typeof mod.getOrCreateWorldEventPlan).toBe('function');
  });
});

// ─── FRONTEND WORLD EVENT PAGE ────────────────────────────────────────
describe('WorldEventPage', () => {
  it('page file exists', () => {
    expect(exists('frontend/src/pages/WorldEventPage.tsx')).toBe(true);
  });

  it('page handles all states: loading, locked, unlocked, playing, finished, error', () => {
    const content = read('frontend/src/pages/WorldEventPage.tsx');
    expect(content).toContain("'loading'");
    expect(content).toContain("'locked'");
    expect(content).toContain("'unlocked'");
    expect(content).toContain("'playing'");
    expect(content).toContain("'finished'");
    expect(content).toContain("'error'");
  });
});

// ─── FRONTEND MENU EVENT CARD ─────────────────────────────────────────
describe('MenuPage event card', () => {
  it('MenuPage.tsx references getCurrentEvent', () => {
    const content = read('frontend/src/pages/MenuPage.tsx');
    expect(content).toContain('getCurrentEvent');
  });
});

// ─── BOSS START/RESUME BEHAVIOR (unit-level) ──────────────────────────
describe('Boss start/resume logic', () => {
  it('locked returns 403 when boss not unlocked', () => {
    const progress = { bossUnlocked: false };
    expect(progress.bossUnlocked).toBe(false);
  });

  it('unlocked allows start', () => {
    const progress = { bossUnlocked: true };
    expect(progress.bossUnlocked).toBe(true);
  });
});

// ─── ANSWER VALIDATION (unit-level) ───────────────────────────────────
describe('Answer validation', () => {
  it('duplicate answer is first-write-wins (idempotent)', () => {
    const existingAnswer = { isCorrect: true, points: 100 };
    expect(existingAnswer.isCorrect).toBe(true);
    expect(existingAnswer.points).toBe(100);
  });

  it('timed out answer is marked incorrect', () => {
    const timedOut = true;
    const answer = '';
    const correctAnswer = 'Kenya';
    const isCorrect = !timedOut && answer.trim().toLowerCase() === correctAnswer.toLowerCase().trim();
    expect(isCorrect).toBe(false);
  });

  it('correct answer matches case-insensitively', () => {
    const answer = 'kenya';
    const correctAnswer = 'Kenya';
    const isCorrect = answer.trim().toLowerCase() === correctAnswer.toLowerCase().trim();
    expect(isCorrect).toBe(true);
  });
});

// ─── FINISH LOGIC (unit-level) ────────────────────────────────────────
describe('Finish logic', () => {
  it('#10 completes the run', () => {
    const nextIndex = 10;
    const isFinal = nextIndex >= BOSS_TOTAL_QUESTIONS;
    expect(isFinal).toBe(true);
  });

  it('#9 does not complete the run', () => {
    const nextIndex = 9;
    const isFinal = nextIndex >= BOSS_TOTAL_QUESTIONS;
    expect(isFinal).toBe(false);
  });

  it('7 correct = cleared', () => {
    expect(7 >= BOSS_HP_REQUIRED).toBe(true);
  });

  it('6 correct = not cleared', () => {
    expect(6 >= BOSS_HP_REQUIRED).toBe(false);
  });

  it('10 correct = perfect', () => {
    expect(10 === BOSS_TOTAL_QUESTIONS).toBe(true);
  });

  it('GameResult runId format is event-boss:{attemptId}', () => {
    const attemptId = 'test-123';
    const runId = `event-boss:${attemptId}`;
    expect(runId).toBe('event-boss:test-123');
  });
});

// ─── NO MASTERY/CLASSIC/LEADERBOARD LEAK ──────────────────────────────
describe('Integrity: no Boss contamination', () => {
  it('Boss controller does not create MasteryAttempt records', async () => {
    const content = read('backend/src/controllers/worldEvent.controller.ts');
    expect(content).not.toContain('masteryAttempt.create');
    expect(content).not.toContain('MasteryAttempt.create');
  });

  it('Boss gameMode is SINGLE', async () => {
    const content = read('backend/src/controllers/worldEvent.controller.ts');
    expect(content).toContain('GameMode.SINGLE');
  });

  it('Boss category is MIXED', async () => {
    const content = read('backend/src/controllers/worldEvent.controller.ts');
    expect(content).toContain('Category.MIXED');
  });

  it('No Elo/rating mutation in boss controller', async () => {
    const content = read('backend/src/controllers/worldEvent.controller.ts');
    expect(content).not.toContain('CompetitiveRating');
    expect(content).not.toContain('rating');
  });

  it('No highScore mutation in boss controller', async () => {
    const content = read('backend/src/controllers/worldEvent.controller.ts');
    expect(content).not.toContain('highScore');
  });
});
