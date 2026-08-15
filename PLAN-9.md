# Plan 9 — Weekly World Events + Bosses + Product/Technical Pruning

## Base SHA
`06542aa35371c5247f134089bd040de1a3a250f9`

## Executive Summary

Plan 9 introduces a **weekly World Event loop** with deterministic regional rotation and Boss fights, plus **product pruning** (lobby hierarchy simplification) and **technical cleanup** (removing Render/PhilServer era code). No new Elo, Daily World Tour, Mastery scoring, or GeoRetos V2 changes.

---

## Phase 1: Database Schema (Prisma)

### 1.1 New Enums

```prisma
enum WorldEventRegion {
  AFRICA
  AMERICAS
  ASIA
  EUROPE
  OCEANIA
}

enum WorldEventBossAttemptStatus {
  ACTIVE
  COMPLETED
  ABANDONED
}
```

### 1.2 New Models

```prisma
model WorldEventPlan {
  eventId      String           @id
  version      String
  region       WorldEventRegion
  questionIds  Json
  stops        Json
  startsAt     DateTime
  endsAt       DateTime
  createdAt    DateTime         @default(now())

  attempts WorldEventBossAttempt[]

  @@index([startsAt])
  @@map("world_event_plans")
}

model WorldEventBossAttempt {
  id                   String @id @default(cuid())
  eventId              String
  userId               String
  status               WorldEventBossAttemptStatus @default(ACTIVE)
  currentQuestionIndex Int @default(0)
  correctCount         Int @default(0)
  score                Int @default(0)
  questionStartedAt    DateTime?
  startedAt            DateTime @default(now())
  expiresAt            DateTime
  finishedAt           DateTime?

  event   WorldEventPlan       @relation(fields: [eventId], references: [eventId])
  user    User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  answers WorldEventBossAnswer[]

  @@index([userId, eventId, startedAt])
  @@index([status, expiresAt])
  @@map("world_event_boss_attempts")
}

model WorldEventBossAnswer {
  id            String @id @default(cuid())
  attemptId     String
  questionId    String
  questionIndex Int
  userAnswer    String
  isCorrect     Boolean
  points        Int
  answeredAt    DateTime @default(now())

  attempt WorldEventBossAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)

  @@unique([attemptId, questionIndex])
  @@unique([attemptId, questionId])
  @@index([attemptId])
  @@map("world_event_boss_answers")
}
```

### 1.3 GameVariant Extension

```prisma
enum GameVariant {
  CLASSIC
  STREAK
  FLASH
  FLAG_MASTER
  GEO_CHALLENGE
  DAILY
  PRACTICE
  EVENT_BOSS  // NEW
}
```

### 1.4 Achievement Seeds

Add 2 new rows to `achievements` table:
- `BOSS_FIRST` — First Boss defeated (correctCount >= 7)
- `BOSS_PERFECT` — Boss 10/10 perfect score

Update comment: "10 fixed rows → 12 fixed rows"

---

## Phase 2: Backend Services

### 2.1 World Event Service (`backend/src/services/worldEvent.service.ts`)

**Constants:**
```typescript
export const WORLD_EVENT_VERSION = 'weekly-world-event-v1';
export const WORLD_EVENT_BOSS_VERSION = 'regional-boss-v1';
export const BOSS_QUESTION_SECONDS = 20;
export const BOSS_SERVER_GRACE_MS = 1500;
```

**Core Functions:**

1. **`getWorldEventWindow(now: Date)`** — Pure function
   - Calculate `eventId` as `YYYY-MM-DD` of the Monday UTC start
   - Calculate `startsAt` (Monday 00:00 UTC) and `endsAt` (next Monday 00:00 UTC)
   - Deterministic region rotation: epoch `2026-08-10` (AFRICA), cycles every 5 weeks
   - Returns `{ eventId, startsAt, endsAt, region }`

2. **`getCurrentWorldEvent()`** — Delegates to `getWorldEventWindow(new Date())`

3. **`getWorldEventProgress(userId: string, eventId: string, region: WorldEventRegion)`**
   - Query `MasteryAttempt` for correct answers in region countries during event window
   - Query `GameResult` for DAILY variant during event window
   - Compute:
     - `correctInRegion`: count of correct attempts with country in region
     - `distinctCategories`: distinct categories from those correct attempts
     - `dailyCompleted`: boolean (any DAILY GameResult in window)
   - Returns `{ correctInRegion, distinctCategories, dailyCompleted, bossUnlocked }`
   - **No counters persisted** — all computed

4. **`buildWorldEventBoss(eventId: string, region: WorldEventRegion)`**
   - Pool: questions with `category IN (FLAG, CAPITAL, SILHOUETTE, MONUMENT, CINEMA_GEO)`
   - Filter to region countries
   - Tier 1: MEDIUM/HARD only
   - Tier 2: any difficulty (fallback)
   - Invariants:
     - Exactly 10 questions
     - 10 unique countryCodes
     - 10 unique questionIds
     - >=3 distinct categories
     - <=4 per category
   - Seed: `hashString(eventId + bossVersion + attempt)`
   - Up to 200 attempts per tier
   - If impossible: throw `503 EVENT_BOSS_POOL_INSUFFICIENT`

5. **`getOrCreateWorldEventPlan(eventId: string)`**
   - Check existing, return if found
   - Build new plan
   - Create with P2002 race handling (same pattern as Daily)

6. **`toPublicBossQuestion(plan, questionIndex)`** — Strip correctAnswer/countryCode

### 2.2 Achievement Extension (`backend/src/services/achievement.service.ts`)

Extend `AchievementKey` type:
```typescript
export type AchievementKey =
  | 'FIRST_GAME' | 'STREAK_10' | 'STREAK_25' | 'STREAK_50'
  | 'PERFECT_GAME' | 'HIGH_SCORE_1K' | 'FIRST_WIN'
  | 'DAILY_FIRST' | 'DAILY_7' | 'DAILY_30'
  | 'BOSS_FIRST' | 'BOSS_PERFECT';  // NEW
```

Add function:
```typescript
export async function evaluateAchievementsAfterBoss(
  userId: string,
  correctCount: number
): Promise<AchievementKey[]>
```

- `BOSS_FIRST`: correctCount >= 7 (first time)
- `BOSS_PERFECT`: correctCount === 10 (first time)
- Also call existing `evaluateAchievementsAfterGame` for FIRST_GAME, PERFECT_GAME, HIGH_SCORE_1K

Update cache comment: "10 fixed rows → 12 fixed rows"

---

## Phase 3: Backend Controller

### 3.1 World Event Controller (`backend/src/controllers/worldEvent.controller.ts`)

Mount at `/api/events` in `backend/src/index.ts`

**Endpoints:**

1. **`GET /api/events/current`** — Side-effect free
   - Returns event info, progress, boss status
   - Progress computed server-side from MasteryAttempt + GameResult
   - Boss status: unlocked, cleared (bestCorrect >= 7), attempts count, best scores
   - Active attempt info if exists

2. **`POST /api/events/current/boss/start`** — Authenticated
   - Recompute progress server-side (never trust client `bossUnlocked`)
   - If locked: `403 EVENT_BOSS_LOCKED`
   - Get or create WorldEventPlan
   - Find ACTIVE attempt: resume if not expired, abandon if expired
   - Create new attempt if none active
   - Attempt expires in 30 minutes
   - Return: attemptId, first question (public only), expiresAt, boss HP info

3. **`POST /api/events/boss/:attemptId/answer`** — Authenticated
   - Validate: owner, ACTIVE, not expired
   - Validate: questionId matches expected at currentQuestionIndex
   - Server-time check: if >20s + 1.5s grace from questionStartedAt, force timeout
   - Validate answer server-side
   - Transaction:
     - Create WorldEventBossAnswer (FIRST WRITE WINS)
     - Update attempt: increment correctCount if correct, +100 score if correct, advance questionIndex, update questionStartedAt
   - On 10th answer: atomic finish
     - Create final answer
     - Set status COMPLETED, finishedAt
     - Create GameResult EVENT_BOSS (runId: `event-boss:${attemptId}`)
     - Increment User.gamesPlayed ONCE
     - NO highScore update
     - NO MasteryAttempt
     - NO leaderboard update
     - NO CompetitiveRating update

---

## Phase 4: Frontend

### 4.1 New Route and Page

- Route: `/event` (ProtectedRoute)
- Page: `WorldEventPage.tsx`

### 4.2 Lobby Changes (`MenuPage.tsx`)

Add World Event card after Daily World Tour section:
- Locked: show progress (X/8 correct, Y/3 categories, Daily status)
- Unlocked: show "Enfrentar Boss" CTA
- Cleared: show best score, "Jugar otra vez" CTA

### 4.3 Lobby Pruning

**Practice panel:**
- Primary: Classic, GeoRetos
- Collapsed "Más formas de entrenar": Flash, Streak, Flag Master

**Compete panel:**
- Primary: Competition Hub, Challenge
- Collapsed "Más formas de competir": Duel casual, Survival, GeoRetos Duel

Routes remain functional — just hierarchy change.

### 4.4 Boss UX

Reuse existing components:
- `UniversalGameLayout` for game shell
- `GameRoundScaffold` for question display
- `Timer` with 20s limit
- `OptionButton` for answers

Boss-specific:
- HP display: 7 hearts or accessible bar
- Impact animation on correct (respect `prefersReducedMotion`)
- Progress: "Pregunta X / 10"

### 4.5 Result Screen

- Clear (>=7): "GUARDIÁN DERROTADO" + score + best personal
- Fail (<7): "EL GUARDIÁN RESISTE" + progress encouragement
- No punitive language

---

## Phase 5: Technical Pruning

### 5.1 Remove BackendKeepAlive

- Delete component and tests
- Remove from App mount

### 5.2 Remove ServerWakeUp

- Delete blocking wrapper
- Keep normal API error handling

### 5.3 Clean i18n keys

- Remove `serverWakeUp.*` keys

### 5.4 Remove keep-awake workflow

- Delete `.github/workflows/keep-backend-awake.yml`

### 5.5 Remove render.yaml

- Delete if exists

### 5.6 Update docs

- Current architecture: GitHub Pages → PhilServer → Neon → local Redis

---

## Phase 6: Tests

### Backend Tests

1. **Event Window Tests** (world-event.service.test.ts)
   - Monday boundary
   - Sunday boundary
   - Year boundary
   - eventId stable
   - 5-region rotation
   - Americas mapping N/S
   - Event duration exactly 7d

2. **Progress Tests**
   - Correct attempts only
   - Wrong attempts ignored
   - Outside event ignored
   - Other region ignored
   - Distinct category count
   - 8 correct reached
   - Daily required
   - Unlocked only when all 3 requirements
   - No progress counters persisted
   - Current status causes no WorldEventPlan.create

3. **Composer Tests**
   - Exactly 10 questions
   - 10 unique questions
   - 10 unique countries
   - Correct region
   - >=3 categories
   - <=4/category
   - No MAP
   - Deterministic same event
   - Different week different plan
   - Tier1 prefers M/H
   - Tier2 fallback
   - Impossible pool => 503
   - P2002 plan race returns winner
   - Rolling simulation: 260 consecutive weeks, every boss valid

4. **Start/Resume Tests**
   - Locked => 403
   - Unlocked => attempt
   - Plan created only on start
   - Active attempt resumed
   - Same start no duplicate
   - Expired active -> ABANDONED
   - Expired creates fresh attempt
   - Other user's attempt inaccessible
   - First question no correctAnswer/countryCode leak

5. **Answer Tests**
   - Only expected question accepted
   - Server validates answer
   - Correct = 100
   - Wrong = 0
   - Timeout server-side = 0
   - Forged client timing irrelevant
   - Duplicate answer no double score
   - Concurrent duplicate first-write-wins
   - Question index advances once
   - questionStartedAt server updated

6. **Finish Tests**
   - 10th answer completes
   - Exactly one GameResult
   - runId deterministic from attempt
   - User.gamesPlayed +1 once
   - User.highScore unchanged
   - No CompetitiveRating mutation
   - No MasteryAttempt
   - Clear at 7
   - Fail at 6
   - Perfect 10
   - Retry final answer idempotent
   - Transaction rollback atomic

7. **Achievement Tests**
   - BOSS_FIRST on first clear
   - Not BOSS_FIRST on fail
   - BOSS_PERFECT 10/10
   - Grants only once
   - Existing 10 achievements unaffected
   - Achievement cache handles 12 rows

8. **Leaderboard Regression Tests**
   - EVENT_BOSS does NOT alter Classic global leaderboard
   - EVENT_BOSS does NOT alter Classic season leaderboard
   - Rankings variant filters do not expose EVENT_BOSS
   - User.highScore unchanged

### Frontend Tests

1. **Lobby Event Tests**
   - Event card renders
   - Locked progress
   - Unlocked
   - Cleared
   - Countdown uses endsAt
   - Click navigates /event
   - API error does not break lobby

2. **Pruning Tests**
   - Practice primary Classic
   - Practice primary GeoRetos
   - Flash hidden until More opened
   - Streak hidden until More opened
   - Flag Master hidden until More opened
   - Routes/actions still work
   - Competition Hub primary
   - Challenge primary
   - Casual Duel collapsed
   - Survival collapsed
   - GeoRetos Duel collapsed
   - All old actions still work

3. **Event Page Tests**
   - Requirements shown
   - Locked CTA
   - Unlocked start
   - Best score
   - Cleared state
   - Start/resume
   - Expired/error state graceful

4. **Boss Tests**
   - Only one question shown
   - HP starts 7
   - Correct decrements HP
   - Incorrect no damage
   - Question progress
   - Timer
   - Timeout submits empty
   - Result after round
   - 7/10 clear
   - 6/10 fail
   - 10/10 perfect
   - Retry start works
   - Refresh resumes active attempt
   - No local/fake finish

5. **Technical Pruning Tests**
   - App no ServerWakeUp wrapper
   - App no BackendKeepAlive
   - No recurring client /health timer
   - Auth routing still works
   - Offline/network error UI still graceful

---

## Phase 7: Deployment

### Order
1. Implement + tests
2. Commit/push
3. `npx prisma migrate deploy` on Neon
4. Rebuild/restart backend on PhilServer
5. Verify: /ping, /health, /api/events/current
6. Deploy GitHub Pages
7. Smoke browser

### Production Smoke Checklist
- [ ] Lobby: World Event visible
- [ ] Locked state: requirements correct
- [ ] Satisfy requirements: unlock from DB truth
- [ ] Start Boss: same region, question public safe
- [ ] Correct/wrong: server score
- [ ] Forged/duplicate: no double answer
- [ ] Finish 7+: cleared
- [ ] Replay: allowed
- [ ] Competition: ratings unchanged
- [ ] Passport/Mastery: Boss replay does not change mastery
- [ ] Rankings: Classic score unchanged

### DB State After Boss
- WorldEventPlan: 1 for current event
- WorldEventBossAttempt: 1 completed
- WorldEventBossAnswer: 10 rows
- GameResult EVENT_BOSS: 1
- MasteryAttempt from boss: 0
- CompetitiveRatingChange from boss: 0
- User.highScore delta: 0
- User.gamesPlayed: +1

---

## Rollback Plan

1. Revert frontend deployment (GitHub Pages)
2. Revert backend deployment (PhilServer)
3. Migration is additive (new tables/enums) — no rollback needed
4. Feature flag can disable /event route if needed

---

## Files to Create/Modify

### New Files
- `backend/src/services/worldEvent.service.ts`
- `backend/src/controllers/worldEvent.controller.ts`
- `frontend/src/pages/WorldEventPage.tsx`
- `backend/prisma/migrations/[timestamp]_add_world_event/migration.sql`
- `backend/src/__tests__/world-event.service.test.ts`
- `backend/src/__tests__/worldEvent.controller.test.ts`
- `frontend/src/__tests__/world-event-page.test.tsx`
- `frontend/src/__tests__/lobby-event-card.test.tsx`
- `frontend/src/__tests__/boss-game.test.tsx`

### Modified Files
- `backend/prisma/schema.prisma` — New enums, models, GameVariant
- `backend/src/index.ts` — Mount world event routes
- `backend/src/services/achievement.service.ts` — Extend AchievementKey, add boss achievements
- `backend/src/config/env.ts` — Add boss constants if needed
- `frontend/src/App.tsx` — Add /event route
- `frontend/src/pages/MenuPage.tsx` — Add event card, pruning
- `frontend/src/components/organisms/LobbyModePanel.tsx` — Pruning hierarchy
- `frontend/src/services/api.ts` — Add event API methods
- `frontend/src/types/index.ts` — Add event types
- `frontend/src/i18n/en.json` — Add event keys
- `frontend/src/i18n/es.json` — Add event keys

### Deleted Files
- `frontend/src/components/BackendKeepAlive.tsx` (if exists)
- `.github/workflows/keep-backend-awake.yml` (if exists)
- `render.yaml` (if exists)

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Boss pool insufficient | Tier fallback + 503 explicit error |
| Concurrent attempt creation | P2002 race handling (same as Daily) |
| Client time manipulation | Server-authoritative timing |
| Mastery farming via Boss replay | EVENT_BOSS excluded from Mastery |
| Classic leaderboard contamination | Explicit checks in tests |
| Lobby pruning breaks routes | Routes preserved, only hierarchy changes |
| Render cleanup breaks health | /health and /ping retained |

---

## Acceptance Criteria

- [ ] Weekly deterministic event with 5-region rotation
- [ ] Server-authoritative progress (no counters/drift)
- [ ] Daily integrated as requirement
- [ ] Shared weekly Boss question plan
- [ ] 10 unique countries, >=3 categories
- [ ] Server timing, first-write-wins
- [ ] Resumable, replayable
- [ ] Clear >=7, permanent GameResult
- [ ] Achievements (BOSS_FIRST, BOSS_PERFECT)
- [ ] No mastery farming
- [ ] No Elo changes
- [ ] No Classic highScore changes
- [ ] No score leaderboard contamination
- [ ] Primary lobby simpler
- [ ] Old routes retained
- [ ] Flash/Streak/FlagMaster demoted
- [ ] Casual competitive modes demoted
- [ ] ServerWakeUp removed
- [ ] BackendKeepAlive removed
- [ ] keep-awake workflow removed
- [ ] Render config/docs removed
- [ ] All new tests pass
- [ ] All retained regressions pass
- [ ] Typechecks pass
- [ ] Lint 0 errors
- [ ] Builds pass
- [ ] Prisma valid
- [ ] Predeploy passes
